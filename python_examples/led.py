#!/usr/bin/env python3
import signal
import sys
import rgb_led

# Broches physiques libres : l'ultrason utilise déjà les broches 11 et 12.
R, G, B = 15, 16, 18


def stop(signum, frame):
    sys.exit(0)


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, stop)
    rgb_led.setup(R, G, B)
    try:
        for line in sys.stdin:
            try:
                values = [int(value) for value in line.strip().split(";")]
                if len(values) != 3 or any(value < 0 or value > 255 for value in values):
                    raise ValueError()
                red, green, blue = values
                rgb_led.setColor((red << 16) | (green << 8) | blue)
            except ValueError:
                print("Alerte RGB invalide, ignorée.", file=sys.stderr)
    except KeyboardInterrupt:
        pass
    finally:
        rgb_led.destroy()
