import './index.css'

export default function TabBar ({ tabs, activeTabId, onChange, showIndexBadge = false }) {
  return (
    <div className='tab-bar'>
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          type='button'
          className={`tab-bar-button ${tab.id === activeTabId ? 'is-active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          <span>{tab.name}</span>
          {tab.badge != null
            ? <small>{tab.badge}</small>
            : (showIndexBadge ? <small>{index + 1}</small> : null)}
        </button>
      ))}
    </div>
  )
}
