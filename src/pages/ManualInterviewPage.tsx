import { useParams } from 'react-router-dom';

export default function ManualInterviewPage() {
  const { roomId } = useParams<{ roomId: string }>();

  return (
    <div className="w-full h-screen bg-background">
      <iframe
        src={`https://meet.jit.si/TalentScoutAI-${roomId}`}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="Manual Interview Room"
      />
    </div>
  );
}
