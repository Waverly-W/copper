import './index.css'

export default function SplitLayout ({ left, right }) {
  return (
    <div className='split-layout'>
      <div className='split-layout-panel'>{left}</div>
      <div className='split-layout-panel'>{right}</div>
    </div>
  )
}
