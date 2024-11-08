#!/bin/bash

APP_NAME="whatsapp-bot-81"
SCRIPT_PATH="/home/aio/botwwjs/exp.js"

start() {
    pm2 start $SCRIPT_PATH --name $APP_NAME
    pm2 save
}

stop() {
    pm2 stop $APP_NAME
    pm2 delete $APP_NAME
}

restart() {
    pm2 restart $APP_NAME
}

status() {
    pm2 status $APP_NAME
}

case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    status)
        status
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
esac

