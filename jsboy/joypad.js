class Joypad {
    /**
     * Creates a new Joypad module for the emulator
     * @param {JSBoy} jsboy emulation core
     * @param {boolean} startListening if set it will start listening for KeyEvents immediately
     */
    constructor(jsboy, startListening = true) {

        this.jsboy = jsboy;

        this._listening = false;

        this._binding = {
            Up: 'ArrowUp',
            Down: 'ArrowDown',
            Left: 'ArrowLeft',
            Right: 'ArrowRight',
            A: 'KeyZ',
            B: 'KeyX',
            Start: 'Enter',
            Select: 'Backspace',
            
            ArrowUp: 'Up',
            ArrowDown: 'Down',
            ArrowLeft: 'Left',
            ArrowRight: 'Right',
            KeyZ: 'A',
            KeyX: 'B',
            Enter: 'Start',
            Backspace: 'Select',
        }

        this.joypadState = {
            Right: { type: 2, state: false, },
            Left: { type: 2, state: false, },
            Up: { type: 2, state: false, },
            Down: { type: 2, state: false, },

            A: { type: 1, state: false, },
            B: { type: 1, state: false, },
            Select: { type: 1, state: false, },
            Start: { type: 1, state: false, },
        }

        if (startListening)
            this.listen();
    }

    /**
     * @type {number} the Joypad state as if reading from IO Memory at address 0xFF00
     */
    get state() {
        // P1/JOYP Register
        let joyp = (this.jsboy.memory._io[0] >> 4) & 0b11;

        let result = 0;

        // If bit 4 is reset -> Directional Keys
        if (!(joyp & 1)) {
            // LOW is Selected
            result = !this.joypadState.Right.state | !this.joypadState.Left.state << 1 | !this.joypadState.Up.state << 2 | !this.joypadState.Down.state << 3;
        }
        // If bit 5 is reset -> Button Keys
        if (!(joyp & 2)) {
            // LOW is Selected
            result = !this.joypadState.A.state | !this.joypadState.B.state << 1 | !this.joypadState.Select.state << 2 | !this.joypadState.Start.state << 3;
        }

        return result | joyp << 4 | 0xC0;
    }

    onkeydown(key) {
        if (!key.repeat) {
            // P1/JOYP Register
            let joyp = (this.jsboy.memory._io[0] >> 4) & 0b11;
            let button = this.joypadState[this._binding[key.code]];
            if (button) {
                button.state = true;
                // Trigger Interrupt if the type coincides
                if (button.type & joyp) {
                    this.jsboy._requestInterrupt(INTERRUPTS.Joypad);
                }
            }
        }
    }

    onkeyup(key) {
        let button = this.joypadState[this._binding[key.code]];
        if (button) {
            button.state = false;
        }
    }

    listen() {
        if (!this._listening) {
            document.addEventListener('keydown', this);
            document.addEventListener('keyup', this);
            this._listening = true;
            console.log('JOYPAD is listening');
        }
    }

    unlisten() {
        if (this._listening) {
            console.log('JOYPAD is NOT listening');
            document.removeEventListener('keydown', this);
            document.removeEventListener('keyup', this);
            this._listening = false;
        }
    }

    handleEvent(e) {
        this['on' + e.type](e);
    }

}