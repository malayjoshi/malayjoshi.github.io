from flask import Flask
from prometheus_flask_exporter import PrometheusMetrics

app = Flask(__name__)
metrics = PrometheusMetrics(app)

@app.route("/")
def home():
    return """
    <h1>CI/CD Pipeline Successful!</h1>
    <p>Application deployed on GCP VM using GitHub Actions.</p>
    """

@app.route("/health")
def health():
    return {"status": "UP"}, 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8030)