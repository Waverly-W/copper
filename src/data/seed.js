import { decorateHistoryItems } from '../services/history/history-item'

export const SEED_HISTORY_ITEMS = decorateHistoryItems([
  {
    id: 'history-1',
    type: 'text',
    title: 'pnpm add @tanstack/react-virtual',
    contentText: 'pnpm add @tanstack/react-virtual',
    searchText: 'pnpm add @tanstack/react-virtual react virtual command',
    copyCount: 12,
    createdAt: Date.now() - 1000 * 60 * 60 * 12,
    updatedAt: Date.now() - 1000 * 60 * 2,
    lastCopiedAt: Date.now() - 1000 * 60 * 2
  },
  {
    id: 'history-2',
    type: 'html',
    title: 'uTools developer docs getting started fragment',
    contentText: 'uTools developer docs getting started fragment',
    searchText: 'utools developer docs getting started html fragment',
    copyCount: 3,
    createdAt: Date.now() - 1000 * 60 * 60 * 8,
    updatedAt: Date.now() - 1000 * 60 * 18,
    lastCopiedAt: Date.now() - 1000 * 60 * 18
  },
  {
    id: 'history-3',
    type: 'image',
    title: 'screenshot-2026-03-29-121204.png',
    imageDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==',
    searchText: 'screenshot 2026 03 29 png image',
    copyCount: 1,
    createdAt: Date.now() - 1000 * 60 * 33,
    updatedAt: Date.now() - 1000 * 60 * 33,
    lastCopiedAt: Date.now() - 1000 * 60 * 33
  },
  {
    id: 'history-4',
    type: 'file',
    title: 'clipboard-plugin-prd.md',
    filePaths: ['D:\\WorkSpace\\3-Codes\\AIGC\\copper\\docs\\clipboard-plugin-prd.md'],
    searchText: 'clipboard plugin prd md docs markdown file',
    copyCount: 1,
    createdAt: Date.now() - 1000 * 60 * 60,
    updatedAt: Date.now() - 1000 * 60 * 60,
    lastCopiedAt: Date.now() - 1000 * 60 * 60
  },
  {
    id: 'history-5',
    type: 'text',
    title: 'Support continuous string search and highlighted hits.',
    contentText: 'Support continuous string search and highlighted hits.',
    searchText: 'support continuous string search highlighted hits',
    copyCount: 5,
    createdAt: Date.now() - 1000 * 60 * 60 * 4,
    updatedAt: Date.now() - 1000 * 60 * 60 * 2,
    lastCopiedAt: Date.now() - 1000 * 60 * 60 * 2
  }
])

export const SEED_FAVORITE_TABS = [
  { id: 'favorite-tab-snippets', name: 'Snippets' },
  { id: 'favorite-tab-reply', name: 'Replies' },
  { id: 'favorite-tab-coding', name: 'Commands' }
]

export const SEED_FAVORITE_ITEMS = [
  {
    id: 'favorite-1',
    type: 'text',
    typeLabel: 'Text',
    title: 'Please organize the confirmed requirements into a PRD with MVP and technical risk notes.',
    contentText: 'Please organize the confirmed requirements into a PRD with MVP and technical risk notes.',
    meta: 'Favorite item | PRD workflow',
    relativeTime: 'today',
    tabIds: ['favorite-tab-snippets', 'favorite-tab-reply'],
    searchText: 'organize confirmed requirements into a prd with mvp and technical risk notes'
  },
  {
    id: 'favorite-2',
    type: 'text',
    typeLabel: 'Text',
    title: 'pnpm build && pnpm test',
    contentText: 'pnpm build && pnpm test',
    meta: 'Favorite item | build command',
    relativeTime: 'yesterday',
    tabIds: ['favorite-tab-snippets', 'favorite-tab-coding'],
    searchText: 'pnpm build pnpm test build command'
  },
  {
    id: 'favorite-3',
    type: 'file',
    typeLabel: 'File',
    title: 'weekly-review-template.md',
    filePaths: ['D:\\WorkSpace\\3-Codes\\AIGC\\copper\\docs\\weekly-review-template.md'],
    meta: 'Favorite item | template file',
    relativeTime: 'this week',
    tabIds: ['favorite-tab-snippets'],
    searchText: 'weekly review template md template file'
  }
]
