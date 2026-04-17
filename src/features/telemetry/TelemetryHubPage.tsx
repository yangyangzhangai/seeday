// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/api/README.md
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

type TelemetryModuleCard = {
  title: string;
  route: string;
  description: string;
  useCase: string;
};

export const TelemetryHubPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const modules: TelemetryModuleCard[] = [
    {
      title: t('telemetry_hub_module_user_analytics_title'),
      route: '/telemetry/user-analytics',
      description: t('telemetry_hub_module_user_analytics_desc'),
      useCase: t('telemetry_hub_module_user_analytics_usecase'),
    },
    {
      title: t('telemetry_hub_module_ai_annotation_title'),
      route: '/telemetry/ai-annotation',
      description: t('telemetry_hub_module_ai_annotation_desc'),
      useCase: t('telemetry_hub_module_ai_annotation_usecase'),
    },
    {
      title: t('telemetry_hub_module_live_input_title'),
      route: '/telemetry/live-input',
      description: t('telemetry_hub_module_live_input_desc'),
      useCase: t('telemetry_hub_module_live_input_usecase'),
    },
    {
      title: t('telemetry_hub_module_todo_title'),
      route: '/telemetry/todo-decompose',
      description: t('telemetry_hub_module_todo_desc'),
      useCase: t('telemetry_hub_module_todo_usecase'),
    },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#F7F8FA]">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">{t('telemetry_hub_title')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('telemetry_hub_desc')}
          </p>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {modules.map((module) => (
            <div key={module.route} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900">{module.title}</h2>
              <p className="mt-2 text-sm text-gray-600">{module.description}</p>
              <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">{module.useCase}</p>
              <button
                type="button"
                onClick={() => navigate(module.route)}
                className="mt-4 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                {t('telemetry_hub_open_dashboard')}
              </button>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
};
