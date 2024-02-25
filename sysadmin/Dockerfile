FROM python:3.11-slim

# Set the working directory to /app
WORKDIR /app

# Install pipenv
COPY Pipfile .
RUN pip install pipenv

# Copy all the files required to run the Flask app
COPY . .

# Install the dependencies using pipenv
RUN pipenv install

RUN apt-get update && apt-get install -y cron
RUN echo "0 * * * * python /app/sim_cleaner.py" >> /etc/cron.d/sim_cleaner

# Expose the port and set the command
EXPOSE 8069

CMD pipenv run gunicorn -b 0.0.0.0:8069 --worker-class eventlet -w 1 sim:app

# CMD ["tail", "-f", "/dev/null"]