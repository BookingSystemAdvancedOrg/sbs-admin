# platform-tenants Lambda (arm64, matches the function's architectures).
FROM public.ecr.aws/lambda/python:3.13-arm64

# No third-party dependencies: boto3 ships with the runtime, Stripe is called
# over plain HTTPS (urllib). Add a requirements.txt + pip install here if
# that ever changes.
COPY src/app ${LAMBDA_TASK_ROOT}/app

CMD ["app.handler.handler"]
