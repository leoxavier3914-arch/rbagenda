import SupportThreadView from "../shared/SupportThreadView";

type ThreadPageProps = {
  params: {
    threadId: string;
  };
};

export default function SupportThreadPage({ params }: ThreadPageProps) {
  return <SupportThreadView threadId={params.threadId} />;
}
