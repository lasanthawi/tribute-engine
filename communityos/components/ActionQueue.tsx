import { NextActionDto, SetupStepDto } from '@/lib/api-client'

export function SetupStepper({ steps }: { steps: SetupStepDto[] }) {
  return (
    <section className="co-card">
      <div className="co-section-head">
        <div>
          <span className="co-overline">Launch path</span>
          <h2>Setup journey</h2>
        </div>
        <span className="co-pill">{steps.filter((step) => step.status === 'done').length}/{steps.length}</span>
      </div>
      <div className="co-step-list">
        {steps.map((step, index) => (
          <div className={`co-step ${step.status}`} key={step.id}>
            <span>{index + 1}</span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function ActionQueue({
  actions,
  onOpen,
}: {
  actions: NextActionDto[]
  onOpen: (target: NextActionDto['target']) => void
}) {
  return (
    <section className="co-card">
      <div className="co-section-head">
        <div>
          <span className="co-overline">Next actions</span>
          <h2>What needs attention</h2>
        </div>
        <span className="co-pill warn">{actions.filter((action) => action.priority === 'high').length} urgent</span>
      </div>
      <div className="co-action-list">
        {actions.map((action) => (
          <button className={`co-action ${action.priority}`} key={action.id} type="button" onClick={() => onOpen(action.target)}>
            <div>
              <strong>{action.title}</strong>
              <p>{action.detail}</p>
            </div>
            <span>{action.target}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
