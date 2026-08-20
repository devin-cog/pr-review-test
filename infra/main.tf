terraform {
  required_version = ">= 1.5.0"
}

resource "aws_sqs_queue" "payments" {
  name                       = "payments"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 345600
}

resource "aws_sqs_queue" "payments_dlq" {
  name = "payments-dlq"
}
