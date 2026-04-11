import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5001)
