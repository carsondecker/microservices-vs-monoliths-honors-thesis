import cluster from "node:cluster";

const workers = Number(process.env.WORKERS || 1);

if (cluster.isPrimary) {
  for (let i = 0; i < workers; i++) cluster.fork();

  cluster.on("exit", (worker, code) => {
    console.error(`Worker ${worker.process.pid} exited (${code}), restarting`);
    cluster.fork();
  });
} else {
  import("./index").catch((err) => {
    console.error(err);
    process.exit(1);
  });
}