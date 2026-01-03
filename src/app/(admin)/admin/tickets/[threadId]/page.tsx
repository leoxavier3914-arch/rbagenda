import SupportThreadView from "../../suporte/shared/SupportThreadView";

type ThreadPageProps = {
  params: {
    threadId: string;
  };
};

export default function TicketThreadPage({ params }: ThreadPageProps) {
  return <SupportThreadView threadId={params.threadId} />;
}
