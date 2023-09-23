FROM node:19-slim

RUN apt-get update
RUN apt-get install python3 -y
RUN apt-get install python3-venv -y
RUN apt-get install libgomp1 -y

WORKDIR /app
COPY . /app

RUN npm install

ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

RUN pip3 install -r requirements.txt

CMD ["node", "server.js"]