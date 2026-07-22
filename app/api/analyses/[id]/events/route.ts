import { getJobAsync } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const encoder = new TextEncoder();
  let cancelStream = () => {};
  const stream = new ReadableStream({
    start(controller) {
      let stopped = false;
      let checking = false;
      let timer: ReturnType<typeof setInterval>;

      const stop = (closeController: boolean) => {
        if (stopped) return;
        stopped = true;
        clearInterval(timer);
        request.signal.removeEventListener("abort", handleAbort);
        if (closeController) controller.close();
      };
      const handleAbort = () => stop(false);
      const checkJob = async () => {
        if (stopped || checking) return;
        checking = true;
        try {
          const job = await getJobAsync(params.id);
          if (stopped) return;
          if (!job) {
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: "Analysis not found" })}\n\n`));
            stop(true);
            return;
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(job)}\n\n`));
          if (job.status === "completed" || job.status === "failed") stop(true);
        } catch {
          if (!stopped) {
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: "Unable to read analysis status" })}\n\n`));
            stop(true);
          }
        } finally {
          checking = false;
        }
      };

      timer = setInterval(() => void checkJob(), 700);
      request.signal.addEventListener("abort", handleAbort, { once: true });
      cancelStream = handleAbort;
      void checkJob();
    },
    cancel() {
      cancelStream();
    }
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
}
