// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/api/README.md
import React from 'react';
import { useNavigate } from 'react-router-dom';

type TelemetryModuleCard = {
  title: string;
  route: string;
  description: string;
  useCase: string;
};

const MODULES: TelemetryModuleCard[] = [
  {
    title: 'User Analytics',
    route: '/telemetry/user-analytics',
    description: 'New users, DAU, premium conversion, D7 retention, and per-user lookup.',
    useCase: 'Use this board to monitor growth, track premium conversion, and look up specific users.',
  },
  {
    title: 'AI Annotation Reply',
    route: '/telemetry/ai-annotation',
    description: 'Covers low-density scoring, lateral-association sampling, trigger, and condensation telemetry.',
    useCase: 'Use this board to calibrate trigger probability and monitor whether lateral association is too weak or too frequent.',
  },
  {
    title: 'Live Input + Classifier',
    route: '/telemetry/live-input',
    description: 'Covers classification and correction quality, plus merged plant fallback and diary sticker telemetry.',
    useCase: 'Use this board to inspect parser quality, correction loops, and fallback stability across languages.',
  },
  {
    title: 'Todo Decompose',
    route: '/telemetry/todo-decompose',
    description: 'Covers todo step-breakdown quality, parse stability, and user regenerate behavior.',
    useCase: 'Use this board to decide prompt/model tuning priorities with product-readable metrics and action hints.',
  },
];

export const TelemetryHubPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="h-full overflow-y-auto bg-[#F7F8FA]">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">Telemetry Center</h1>
          <p className="mt-1 text-sm text-gray-500">
            Unified entry for instrumentation dashboards. Choose a business module to inspect detailed metrics,
            event semantics, and operational decision hints.
          </p>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {MODULES.map((module) => (
            <div key={module.route} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900">{module.title}</h2>
              <p className="mt-2 text-sm text-gray-600">{module.description}</p>
              <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">{module.useCase}</p>
              <button
                type="button"
                onClick={() => navigate(module.route)}
                className="mt-4 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Open Dashboard
              </button>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
};
