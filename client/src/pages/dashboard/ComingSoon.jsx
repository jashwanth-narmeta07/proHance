import { EmptyState } from '../../components/ui.jsx';

export default function ComingSoon({ title }) {
  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      <div className="mt-6">
        <EmptyState
          title="This section is coming in a later phase"
          description="The API for this feature hasn't been built yet - see DEVELOPMENT_PHASES.md for what's planned next."
        />
      </div>
    </div>
  );
}
