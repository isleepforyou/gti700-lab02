#!/usr/bin/env python3

import RPi.GPIO as GPIO
import time
import signal
import sys

TRIG = 11
ECHO = 12

def setup():
	GPIO.setmode(GPIO.BOARD)
	GPIO.setup(TRIG, GPIO.OUT)
	GPIO.setup(ECHO, GPIO.IN)

def distance():
	GPIO.output(TRIG, 0)
	time.sleep(0.000002)

	GPIO.output(TRIG, 1)
	time.sleep(0.00001)
	GPIO.output(TRIG, 0)

	deadline = time.monotonic() + 0.04
	while GPIO.input(ECHO) == 0:
		if time.monotonic() > deadline:
			return None
	time1 = time.monotonic()
	deadline = time1 + 0.04
	while GPIO.input(ECHO) == 1:
		if time.monotonic() > deadline:
			return None
	time2 = time.monotonic()

	during = time2 - time1
	return during * 340 / 2 * 100

def loop():
	while True:
		dis = distance()
		if dis is not None:
			print (dis, 'cm', flush=True)
		time.sleep(1)

def destroy():
	GPIO.cleanup()

if __name__ == "__main__":
	signal.signal(signal.SIGTERM, lambda signum, frame: sys.exit(0))
	setup()
	try:
		loop()
	except KeyboardInterrupt:
		pass
	finally:
		destroy()
