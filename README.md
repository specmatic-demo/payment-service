`payment-service` is a consumer of the federated `notification-service` AsyncAPI contract.

It consumes:
- repository: `https://github.com/specmatic-demo/notification-service`
- branch: `migrated_to_federated_repo`
- spec: `specs/asyncapi.yaml`

Run the local validation flow from the `payment-service` repository root.

Start the dependency mock:

```bash
docker run --rm -it \
  -v "$(pwd):/usr/src/app" \
  -v ~/.specmatic:/root/.specmatic \
  -w /usr/src/app \
  --network=host \
  specmatic/enterprise \
  mock
```

This starts the `notification-service` AsyncAPI mock against Kafka on `localhost:9092`.

In another terminal, start the service:

```bash
docker compose up --build
```

In a third terminal, run contract tests:

```bash
docker run --rm -it \
  -v "$(pwd):/usr/src/app" \
  -v ~/.specmatic:/root/.specmatic \
  -w /usr/src/app \
  --network=host \
  specmatic/enterprise \
  test
```

Send the service test report to Insights:

```bash
docker run -it \
  -v "$(pwd):/usr/src/app" \
  -v ~/.specmatic:/root/.specmatic \
  -w /usr/src/app \
  --network=host \
  specmatic/specmatic \
  send-report \
  --branch-name=main \
  --repo-name="$(gh repo view --json name -q .name)" \
  --repo-id="$(gh api 'repos/{owner}/{repo}' --jq .id)" \
  --repo-url="$(gh repo view --json url --jq .url)"
```

If you want to verify async usage coverage locally:
- run the tests while the mock is running
- stop the mock cleanly with `Ctrl+C`
- then inspect `build/reports/specmatic/async/stub/ctrf/ctrf-report.json`

The async stub CTRF report is finalized when the mock process exits, so the file can look stale until then.
