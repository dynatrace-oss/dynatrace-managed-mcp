// Global test teardown to handle axios connection cleanup
export default async function teardown() {
  // Force exit after a short delay
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}
