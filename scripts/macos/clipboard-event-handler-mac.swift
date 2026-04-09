import AppKit
import CryptoKit
import Foundation

struct ImagePayload: Encodable {
  let assetId: String
  let imagePath: String
  let width: Int
  let height: Int
  let byteSize: Int
  let mimeType: String
}

struct CaptureEvent: Encodable {
  let event = "clipboard_capture"
  let source = "native-mac"
  let changeCount: Int
  let capturedAt: Int64
  let kind: String
  let signature: String
  let text: String?
  let filePaths: [String]?
  let image: ImagePayload?
}

enum ClipboardCapture {
  case text(String)
  case file([String])
  case image(Data, NSSize, String)
}

final class ClipboardMonitor {
  private let pasteboard = NSPasteboard.general
  private let fileManager = FileManager.default
  private let imageDirectory: URL
  private let pollIntervalUs: useconds_t
  private let resampleDelaysUs: [useconds_t] = [15000, 35000, 60000]
  private var lastObservedChangeCount: Int
  private var lastEmittedSignature = ""
  private let encoder = JSONEncoder()

  init(imageDirectory: URL, pollIntervalMs: Int) {
    self.imageDirectory = imageDirectory
    self.pollIntervalUs = useconds_t(max(pollIntervalMs, 20) * 1000)
    self.lastObservedChangeCount = pasteboard.changeCount
  }

  func run() {
    ensureImageDirectory()

    while true {
      captureIfChanged()
      usleep(pollIntervalUs)
    }
  }

  private func captureIfChanged() {
    let nextChangeCount = pasteboard.changeCount
    guard nextChangeCount != lastObservedChangeCount else { return }

    lastObservedChangeCount = nextChangeCount
    emitCurrentSnapshot(changeCount: nextChangeCount)

    for delay in resampleDelaysUs {
      usleep(delay)
      let resampleCount = pasteboard.changeCount
      guard resampleCount != lastObservedChangeCount else { continue }

      lastObservedChangeCount = resampleCount
      emitCurrentSnapshot(changeCount: resampleCount)
    }
  }

  private func emitCurrentSnapshot(changeCount: Int) {
    guard let capture = readCapture() else { return }

    let event: CaptureEvent
    switch capture {
      case .file(let paths):
        let signature = "files:\(paths.joined(separator: "|"))"
        guard shouldEmit(signature: signature) else { return }
        event = CaptureEvent(
          changeCount: changeCount,
          capturedAt: Int64(Date().timeIntervalSince1970 * 1000),
          kind: "file",
          signature: signature,
          text: nil,
          filePaths: paths,
          image: nil
        )
      case .image(let pngData, let size, let assetId):
        let imagePath = imageDirectory.appendingPathComponent("\(assetId).png")
        if !fileManager.fileExists(atPath: imagePath.path) {
          try? pngData.write(to: imagePath, options: .atomic)
        }

        let signature = "image:\(assetId)"
        guard shouldEmit(signature: signature) else { return }
        event = CaptureEvent(
          changeCount: changeCount,
          capturedAt: Int64(Date().timeIntervalSince1970 * 1000),
          kind: "image",
          signature: signature,
          text: nil,
          filePaths: nil,
          image: ImagePayload(
            assetId: assetId,
            imagePath: imagePath.path,
            width: Int(size.width),
            height: Int(size.height),
            byteSize: pngData.count,
            mimeType: "image/png"
          )
        )
      case .text(let text):
        let signature = "text:\(text)"
        guard shouldEmit(signature: signature) else { return }
        event = CaptureEvent(
          changeCount: changeCount,
          capturedAt: Int64(Date().timeIntervalSince1970 * 1000),
          kind: "text",
          signature: signature,
          text: text,
          filePaths: nil,
          image: nil
        )
    }

    guard let payload = try? encoder.encode(event),
          let line = String(data: payload, encoding: .utf8) else { return }
    FileHandle.standardOutput.write(Data(line.utf8))
    FileHandle.standardOutput.write(Data("\n".utf8))
  }

  private func readCapture() -> ClipboardCapture? {
    if let filePaths = readFilePaths(), !filePaths.isEmpty {
      return .file(filePaths)
    }

    if let imageCapture = readImageCapture() {
      return imageCapture
    }

    let text = (pasteboard.string(forType: .string) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    if !text.isEmpty {
      return .text(text)
    }

    return nil
  }

  private func readFilePaths() -> [String]? {
    var paths: [String] = []

    for item in pasteboard.pasteboardItems ?? [] {
      if let fileURL = item.string(forType: .fileURL),
         let url = URL(string: fileURL),
         url.isFileURL {
        let filePath = url.path
        if fileManager.fileExists(atPath: filePath) {
          paths.append(filePath)
        }
      }
    }

    if !paths.isEmpty {
      return paths
    }

    if let rawValue = pasteboard.string(forType: NSPasteboard.PasteboardType("NSFilenamesPboardType")) {
      let pattern = "<string>(.*?)</string>"
      let regex = try? NSRegularExpression(pattern: pattern)
      let range = NSRange(rawValue.startIndex..<rawValue.endIndex, in: rawValue)
      let parsedPaths = regex?.matches(in: rawValue, range: range).compactMap { match in
        guard match.numberOfRanges > 1,
          let matchRange = Range(match.range(at: 1), in: rawValue) else {
          return nil
        }

        return String(rawValue[matchRange])
      }.filter { fileManager.fileExists(atPath: $0) } ?? []
      if !parsedPaths.isEmpty {
        return parsedPaths
      }
    }

    return nil
  }

  private func readImageCapture() -> ClipboardCapture? {
    let pngType = NSPasteboard.PasteboardType.png
    let tiffType = NSPasteboard.PasteboardType.tiff

    for item in pasteboard.pasteboardItems ?? [] {
      if let pngData = item.data(forType: pngType),
         let image = NSImage(data: pngData) {
        return .image(pngData, image.size, bitmapAssetId(from: image))
      }

      if let tiffData = item.data(forType: tiffType),
         let bitmap = NSBitmapImageRep(data: tiffData),
         let pngData = bitmap.representation(using: .png, properties: [:]) {
        return .image(
          pngData,
          NSSize(width: bitmap.pixelsWide, height: bitmap.pixelsHigh),
          bitmapAssetId(from: bitmap) ?? sha1Hex(pngData)
        )
      }
    }

    if let pngData = pasteboard.data(forType: pngType),
       let image = NSImage(data: pngData) {
      return .image(pngData, image.size, bitmapAssetId(from: image))
    }

    if let tiffData = pasteboard.data(forType: tiffType),
       let bitmap = NSBitmapImageRep(data: tiffData),
       let pngData = bitmap.representation(using: .png, properties: [:]) {
      return .image(
        pngData,
        NSSize(width: bitmap.pixelsWide, height: bitmap.pixelsHigh),
        bitmapAssetId(from: bitmap) ?? sha1Hex(pngData)
      )
    }

    if let images = pasteboard.readObjects(forClasses: [NSImage.self], options: nil) as? [NSImage],
       let image = images.first,
       let tiffData = image.tiffRepresentation,
       let bitmap = NSBitmapImageRep(data: tiffData),
       let pngData = bitmap.representation(using: .png, properties: [:]) {
      let size = image.size == .zero
        ? NSSize(width: bitmap.pixelsWide, height: bitmap.pixelsHigh)
        : image.size
      return .image(
        pngData,
        size,
        bitmapAssetId(from: image)
      )
    }

    return nil
  }

  private func shouldEmit(signature: String) -> Bool {
    guard !signature.isEmpty else { return false }
    guard signature != lastEmittedSignature else { return false }

    lastEmittedSignature = signature
    return true
  }

  private func ensureImageDirectory() {
    try? fileManager.createDirectory(at: imageDirectory, withIntermediateDirectories: true)
  }

  private func sha1Hex(_ data: Data) -> String {
    Insecure.SHA1.hash(data: data).map { String(format: "%02x", $0) }.joined()
  }

  private func bitmapAssetId(from image: NSImage) -> String {
    guard let tiffData = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiffData),
      let assetId = bitmapAssetId(from: bitmap) else {
      return sha1Hex(image.tiffRepresentation ?? Data())
    }

    return assetId
  }

  private func bitmapAssetId(from bitmap: NSBitmapImageRep) -> String? {
    guard let cgImage = bitmap.cgImage else { return nil }
    let width = cgImage.width
    let height = cgImage.height
    guard width > 0, height > 0 else { return nil }

    let bytesPerPixel = 4
    let bytesPerRow = width * bytesPerPixel
    let bitsPerComponent = 8
    var pixels = Data(count: bytesPerRow * height)

    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let bitmapInfo = CGBitmapInfo.byteOrder32Big.union(
      CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue)
    )

    let rendered = pixels.withUnsafeMutableBytes { rawBuffer in
      guard let baseAddress = rawBuffer.baseAddress else { return false }
      guard let context = CGContext(
        data: baseAddress,
        width: width,
        height: height,
        bitsPerComponent: bitsPerComponent,
        bytesPerRow: bytesPerRow,
        space: colorSpace,
        bitmapInfo: bitmapInfo.rawValue
      ) else {
        return false
      }

      context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
      return true
    }

    guard rendered else { return nil }
    return sha1Hex(pixels)
  }
}

func parseArgument(named name: String) -> String? {
  let arguments = CommandLine.arguments
  guard let index = arguments.firstIndex(of: name), index + 1 < arguments.count else {
    return nil
  }

  return arguments[index + 1]
}

let imageDirectoryPath = parseArgument(named: "--image-dir") ??
  NSTemporaryDirectory().appending("/clipboard-plugin/assets/images")
let pollIntervalMs = Int(parseArgument(named: "--poll-interval-ms") ?? "40") ?? 40

let monitor = ClipboardMonitor(
  imageDirectory: URL(fileURLWithPath: imageDirectoryPath, isDirectory: true),
  pollIntervalMs: pollIntervalMs
)

monitor.run()
