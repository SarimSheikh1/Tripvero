export function registerTripTools(data) {
  const context = document.modelContext;
  if (!context?.registerTool || !data) return;
  const lifecycle = new AbortController();
  try {
    Promise.resolve(
      context.registerTool(
        {
          name: "get_open_trip_summary",
          title: "Get open trip summary",
          description:
            "Read the budget, spending, remaining amount and settlement balances shown on the currently open Tripvero trip. Does not change records.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute(input) {
            if (
              !input ||
              typeof input !== "object" ||
              Array.isArray(input) ||
              Object.keys(input).length
            )
              throw new Error("Expected an empty object");
            return {
              trip: data.trip.name,
              currency: data.trip.currency,
              budget: data.trip.budget,
              spent: data.analytics.spent,
              remaining: data.analytics.remaining,
              outstanding: data.analytics.outstanding,
              balances: data.analytics.rows.map((r) => ({
                name: r.user.name,
                balance: r.balance,
              })),
            };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
  } catch {
    lifecycle.abort();
  }
  return () => lifecycle.abort();
}
