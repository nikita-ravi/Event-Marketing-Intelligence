export type PipelineStep =
  | 'search'
  | 'baseline'
  | 'reasoning'
  | 'guardrail'
  | 'result';

export type StepStatus = 'pending' | 'running' | 'done' | 'failed';

export interface PipelineState {
  search: { status: StepStatus; details?: string };
  baseline: { status: StepStatus; details?: string };
  reasoning: { status: StepStatus; details?: string };
  guardrail: { status: StepStatus; details?: string };
  result: { status: StepStatus; details?: string };
}

interface PipelineSidebarProps {
  pipeline: PipelineState;
}

export function PipelineSidebar({ pipeline }: PipelineSidebarProps) {
  const getStatusBadge = (status: StepStatus) => {
    switch (status) {
      case 'done':
        return <span className="status-badge done">Done</span>;
      case 'running':
        return <span className="status-badge running">Live</span>;
      case 'failed':
        return <span className="status-badge failed">Failed</span>;
      default:
        return null;
    }
  };

  const getStatusIcon = (status: StepStatus) => {
    switch (status) {
      case 'done':
        return '✓';
      case 'running':
        return '◉';
      case 'failed':
        return '✕';
      default:
        return '◯';
    }
  };

  return (
    <div className="pipeline-sidebar">
      <h3 className="pipeline-title">AGENT PIPELINE</h3>

      <div className={`pipeline-step ${pipeline.search.status}`}>
        <div className="step-icon">{getStatusIcon(pipeline.search.status)}</div>
        <div className="step-content">
          <div className="step-header">
            <span className="step-name">Search events</span>
            {getStatusBadge(pipeline.search.status)}
          </div>
          {pipeline.search.details && (
            <div className="step-details">{pipeline.search.details}</div>
          )}
        </div>
      </div>

      <div className="pipeline-connector" />

      <div className={`pipeline-step ${pipeline.baseline.status}`}>
        <div className="step-icon">{getStatusIcon(pipeline.baseline.status)}</div>
        <div className="step-content">
          <div className="step-header">
            <span className="step-name">Baseline scoring</span>
            {getStatusBadge(pipeline.baseline.status)}
          </div>
          {pipeline.baseline.details && (
            <div className="step-details">{pipeline.baseline.details}</div>
          )}
        </div>
      </div>

      <div className="pipeline-connector" />

      <div className={`pipeline-step ${pipeline.reasoning.status}`}>
        <div className="step-icon">{getStatusIcon(pipeline.reasoning.status)}</div>
        <div className="step-content">
          <div className="step-header">
            <span className="step-name">LLM reasoning</span>
            {getStatusBadge(pipeline.reasoning.status)}
          </div>
          {pipeline.reasoning.details && (
            <div className="step-details">{pipeline.reasoning.details}</div>
          )}
        </div>
      </div>

      <div className="pipeline-connector" />

      <div className={`pipeline-step ${pipeline.guardrail.status}`}>
        <div className="step-icon">{getStatusIcon(pipeline.guardrail.status)}</div>
        <div className="step-content">
          <div className="step-header">
            <span className="step-name">Guardrail check</span>
            {getStatusBadge(pipeline.guardrail.status)}
          </div>
          {pipeline.guardrail.details && (
            <div className="step-details">{pipeline.guardrail.details}</div>
          )}
        </div>
      </div>

      <div className="pipeline-connector" />

      <div className={`pipeline-step ${pipeline.result.status}`}>
        <div className="step-icon">{getStatusIcon(pipeline.result.status)}</div>
        <div className="step-content">
          <div className="step-header">
            <span className="step-name">Present result</span>
            {getStatusBadge(pipeline.result.status)}
          </div>
          {pipeline.result.details && (
            <div className="step-details">{pipeline.result.details}</div>
          )}
        </div>
      </div>
    </div>
  );
}
