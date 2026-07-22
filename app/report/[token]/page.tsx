import { AnalyzerShell } from "../../components/AnalyzerShell";

export default function ReportPage({ params }: { params: { token: string } }) {
  return <AnalyzerShell reportToken={params.token} />;
}
