import './index.css'

export default function PaneHeader ({ title, count, isActive, actions = [] }) {
  return (
    <header className={`pane-header ${isActive ? 'is-active' : ''}`}>
      <div className='pane-header-title'>
        <h2>{title}</h2>
        <span className='pane-header-count'>{count}</span>
      </div>
      {actions.length
        ? (
          <div className='pane-header-actions'>
            {actions.map((action) => (
              <button
                key={action.key}
                type='button'
                className='pane-header-action'
                onClick={action.onClick}
                title={action.label}
                aria-label={action.label}
              >
                {action.icon || action.label}
              </button>
            ))}
          </div>
          )
        : null}
    </header>
  )
}
