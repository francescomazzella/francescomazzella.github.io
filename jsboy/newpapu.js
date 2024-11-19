class PAPU {
    /**
     * Creates a new PAPU (Pseudo Audio Processing Unit) module for the emulator
     * @param {JSBoy} jsboy emulation core
     */
    constructor(jsboy) {
        
        this.jsboy = jsboy;

        this.baseCyclesPerIteration = EMULATOR_CONFIGURATION.clockSpeed / 1000 * 8;
        this.cyclesTotalRoundoff = this.baseCyclesPerIteration % 4;
        this.cyclesTotalBase = this.cyclesTotal = this.baseCyclesPerIteration - this.cyclesTotalRoundoff | 0;

        this.soundOn = true;

        /** @type {AudioDevice} */
        this.device;

        this._connectDevice();

        this.VinLeftChannelMasterVolume = 0;
        this.VinRightChannelMasterVolume = 0;

        this.bufferLength = 0;
        this.audioTick = 0;
        this.audioIndex = 0;
        this.bufferContainAmount = 0;
        this.bufferPosition = 0;
        this.downSampleInput = 0;

        this._initBuffer();

        this._dutyLookup = [
            [false, false, false, false, false, false, false, true],
            [true, false, false, false, false, false, false, true],
            [true, false, false, false, false, true, true, true],
            [false, true, true, true, true, true, true, false]
        ];

        this.channel1 = new Channel1(this);
        this.channel2 = new Channel2(this);
        this.channel3 = new Channel3(this);
        this.channel4 = new Channel4(this);

        let self = this;

        this.registers = {
            // FF24
            NR50: {
                _value: 0,

                get enableVinL() { return this._value >> 7; },
                get leftVolume() { return (this._value >> 4) & 7; },
                get enableVinR() { return (this._value >> 3) & 1; },
                get rightVolume() { return this._value & 7; },

                set value(value) {
                    if (self.registers.NR52.masterEnable && this._value != value) {
                        self.runJIT();
                        this._value = value;
                        self.VinLeftChannelMasterVolume = (value >> 4 & 0x7) + 1;
                        self.VinRightChannelMasterVolume = (value & 0x7) + 1;
                        self.cacheMixerOutputLevel();
                    }
                }
            },
            // FF25
            NR51: {
                _value: 0,

                get channel4Left() { return this._value >> 7; },
                get channel3Left() { return (this._value >> 6) & 1; },
                get channel2Left() { return (this._value >> 5) & 1; },
                get channel1Left() { return (this._value >> 4) & 1; },
                get channel4Right() { return (this._value >> 3) & 1; },
                get channel3Right() { return (this._value >> 2) & 1; },
                get channel2Right() { return (this._value >> 1) & 1; },
                get channel1Right() { return this._value; },

                set value(value) {
                    if (self.registers.NR52.masterEnable && this._value != value) {
                        self.runJIT();
                        this._value = value;
                        self.channel1.right = (value & 1) === 1;
                        self.channel2.right = (value & 2) === 2;
                        self.channel3.right = (value & 4) === 4;
                        self.channel4.right = (value & 8) === 8;

                        self.channel1.left = (value & 0x10) === 0x10;
                        self.channel2.left = (value & 0x20) === 0x20;
                        self.channel3.left = (value & 0x40) === 0x40;
                        self.channel4.left = value > 0x7F;
                        
                        self.channel1.cacheOutputLevel();
                        self.channel2.cacheOutputLevel();
                        self.channel3.cacheOutputLevel();
                        self.channel4.cacheOutputLevel();
                    }
                }
            },
            // FF26
            NR52: {
                _value: 0,

                get masterEnable() { return this._value >> 7; },

                get channel4On() { return this._value >> 3 & 1; },
                get channel2On() { return this._value >> 2 & 1; },
                get channel3On() { return this._value >> 2 & 1; },
                get channel1On() { return this._value      & 1; },

                set value(value) {
                    self.runJIT();
                    if (!this.masterEnable && value > 0x7F) {
                        this._value = 0x80;
                        self.initStartState();
                    } else if (this.masterEnable && value < 0x80) {
                        this._value = 0;
                        self.reset();
                    }
                }
            },
        };
    }

    _connectDevice() {
        this.resamplerFirstPassFactor = Math.max(Math.min((EMULATOR_CONFIGURATION.clockSpeed / 44100) | 0, (0xFFFF / 0x1E0) | 0), 1);
        this.downSampleInputDivider = 1 / (this.resamplerFirstPassFactor * 0xF0);

        this.device = new AudioDevice(undefined, 2, undefined, 1);
        this.device.sampleRate = EMULATOR_CONFIGURATION.clockSpeed / this.resamplerFirstPassFactor;
        this.device.maxBufferSize = Math.max(this.baseCyclesPerIteration * 20 / this.resamplerFirstPassFactor, 8192) << 1;
        this.device.init();
    }

    initStartState() {
        this.channel1.frequencyTracker = 0x2000;
        this.channel1.dutyTracker = 0;
        this.channel1.cachedDuty = this._dutyLookup[2];
        this.channel1.totalLength = 0;
        this.channel1.envelopeVolume = 0;
        this.channel1.envelopeType = false;
        this.channel1.envelopeSweeps = 0;
        this.channel1.envelopeSweepsLast = 0;
        this.channel1.consecutive = true;
        this.channel1.frequency = 0;
        this.channel1.sweepFault = false;
        this.channel1.shadowFrequency = 0;
        this.channel1.timeSweep = 1;
        this.channel1.lastTimeSweep = 0;
        this.channel1.swept = false;
        this.channel1.frequencySweepDivider = 0;
        this.channel1.decreaseSweep = false;
        this.channel1.enabled = false;
        this.channel1.canPlay = false;

        this.channel2.frequencyTracker = 0x2000;
        this.channel2.dutyTracker = 0;
        this.channel2.cachedDuty = this._dutyLookup[2];
        this.channel2.totalLength = 0;
        this.channel2.envelopeVolume = 0;
        this.channel2.envelopeType = false;
        this.channel2.envelopeSweeps = 0;
        this.channel2.envelopeSweepsLast = 0;
        this.channel2.consecutive = true;
        this.channel2.frequency = 0;
        this.channel2.enabled = false;
        this.channel2.canPlay = false;

        this.channel3.envelopeVolume = 0;
        this.channel3.totalLength = 0;
        this.channel3.patternType = 4;
        this.channel3.frequency = 0;
        this.channel3.consecutive = true;
        this.channel3.counter = 0x800;
        this.channel3.frequencyPeriod = 0x800;
        this.channel3.lastSampleLookup = 0;
        this.channel3.cachedSample = 0;
        this.channel3.enabled = false;
        this.channel3.canPlay = false;
        this.channel3.pcm.fill(0);

        this.channel4.frequencyPeriod = 8;
        this.channel4.totalLength = 0;
        this.channel4.envelopeVolume = 0;
        this.channel4.currentVolume = 0;
        this.channel4.envelopeType = false;
        this.channel4.envelopeSweeps = 0;
        this.channel4.envelopeSweepsLast = 0;
        this.channel4.consecutive = true;
        this.channel4.bitRange = 0x7fff;
        this.channel4.volumeShifter = 15;
        this.channel4.lastSampleLookup = 0;
        this.channel4.counter = 8;
        this.channel4.cachedSample = 0;
        this.channel4.enabled = false;
        this.channel4.canPlay = false;

        
        this.VinLeftChannelMasterVolume = 8;
        this.VinRightChannelMasterVolume = 8;
        this.mixerOutputCache = 0;
        this.sequencerClocks = 0x2000;
        this.sequencePosition = 0;
        this.audioClocksUntilNextEvent = 1;
        this.audioClocksUntilNextEventCounter = 1;

        this.channel1.cacheOutputLevel();
        this.channel2.cacheOutputLevel();
        this.channel3.cacheOutputLevel();
        this.channel4.cacheOutputLevel();

        this.channel4.noiseSampleTable = this.channel4._lsfr15Table;
    }

    generate(samplesNum) {
        if (this.registers.NR52.masterEnable && !this.jsboy.stopped) {
            for (let clockUpTo = 0; samplesNum > 0;) {
                clockUpTo = Math.min(this.audioClocksUntilNextEventCounter, this.sequencerClocks, samplesNum);
                this.audioClocksUntilNextEventCounter -= clockUpTo;
                this.sequencerClocks -= clockUpTo;
                samplesNum -= clockUpTo;
                while (clockUpTo > 0) {
                    const multiplier = Math.min(clockUpTo, this.resamplerFirstPassFactor - this.audioIndex);
                    clockUpTo -= multiplier;
                    this.audioIndex += multiplier;
                    this.downSampleInput += this.mixerOutputCache * multiplier;
                    if (this.audioIndex === this.resamplerFirstPassFactor) {
                        this.audioIndex = 0;
                        this.outputAudio();
                    }
                }
                if (this.sequencerClocks === 0) {
                    this.audioComputeSequencer();
                    this.sequencerClocks = 0x2000;
                }
                if (this.audioClocksUntilNextEventCounter === 0) {
                    this.computeChannels();
                }
            }
        } else {
            while (samplesNum > 0) {
                const multiplier = Math.min(samplesNum, this.resamplerFirstPassFactor - this.audioIndex);
                samplesNum -= multiplier;
                this.audioIndex += multiplier;
                if (this.audioIndex === this.resamplerFirstPassFactor) {
                    this.audioIndex = 0;
                    this.outputAudio();
                }
            }
        }
    }

    generateFake(samplesNum) {
        if (this.registers.NR52.masterEnable && !this.jsboy.stopped) {
            let clockUpTo = 0;
            while (samplesNum > 0) {
                clockUpTo = Math.min(this.audioClocksUntilNextEventCounter, this.sequencerClocks, samplesNum);
                this.audioClocksUntilNextEventCounter -= clockUpTo;
                this.sequencerClocks -= clockUpTo;
                samplesNum -= clockUpTo;
                if (this.sequencerClocks === 0) {
                    this.audioComputeSequencer();
                    this.sequencerClocks = 0x2000;
                }
                if (this.audioClocksUntilNextEventCounter === 0) {
                    this.computeChannels();
                }
            }
        }
    }

    runJIT() {
        if (this.soundOn) {
            this.generate(this.audioTicks);
        } else {
            this.generateFake(this.audioTicks);
        }
        this.audioTicks = 0;
    }

    audioComputeSequencer() {
        switch (this.sequencePosition++) {
            case 0:
                this.clockLength();
                break;
            case 2:
                this.clockLength();
                this.channel1.clockSweep();
                break;
            case 4:
                this.clockLength();
                break;
            case 6:
                this.clockLength();
                this.channel1.clockSweep();
                break;
            case 7:
                this.clockEnvelope();
                this.sequencePosition = 0;
                break;
        }
    }

    clockLength() {
        this.channel1.clockLength();
        this.channel2.clockLength();
        this.channel3.clockLength();
        this.channel4.clockLength();
    }

    clockEnvelope() {
        this.channel1.clockEnvelope();
        this.channel2.clockEnvelope();
        this.channel4.clockEnvelope();
    }

    computeChannels() {
        this.channel1.frequencyCounter -= this.audioClocksUntilNextEvent;
        this.channel2.frequencyCounter -= this.audioClocksUntilNextEvent;
        this.channel3.counter -= this.audioClocksUntilNextEvent;
        this.channel4.counter -= this.audioClocksUntilNextEvent;

        if (this.channel1.frequencyCounter === 0) {
            this.channel1.frequencyCounter = this.channel1.frequencyTracker;
            this.channel1.dutyTracker = this.channel1.dutyTracker + 1 & 0x7;
            this.channel1.cacheOutputLevelTrimary();
        }
        if (this.channel2.frequencyCounter === 0) {
            this.channel2.frequencyCounter = this.channel2.frequencyTracker;
            this.channel2.dutyTracker = this.channel2.dutyTracker + 1 & 0x7;
            this.channel2.cacheOutputLevelTrimary();
        }
        if (this.channel3.counter === 0) {
            if (this.channel3.canPlay) {
                this.channel3.lastSampleLookup = this.channel3.lastSampleLookup + 1 & 0x1F;
            }
            this.channel3.counter = this.channel3.frequencyPeriod;
            this.channel3.cacheUpdate();
        }
        if (this.channel4.counter === 0) {
            this.channel4.lastSampleLookup = this.channel4.lastSampleLookup + 1 & this.channel4.bitRange;
            this.channel4.counter = this.channel4.frequencyPeriod;
            this.channel4.cacheUpdate();
        }

        this.audioClocksUntilNextEventCounter = this.audioClocksUntilNextEvent = Math.min(this.channel1.frequencyCounter, this.channel2.frequencyCounter, this.channel3.counter, this.channel4.counter);
    }

    cacheMixerOutputLevel() {
        const currentLeftSample = this.channel1.currentSampleLeftTrimary + this.channel2.currentSampleLeftTrimary + this.channel3.currentSampleLeftSecondary + this.channel4.currentSampleLeftSecondary;
        const currentRightSample = this.channel1.currentSampleRightTrimary + this.channel2.currentSampleRightTrimary + this.channel3.currentSampleRightSecondary + this.channel4.currentSampleRightSecondary;
        this.mixerOutputCache = currentLeftSample * this.VinLeftChannelMasterVolume << 16 | currentRightSample * this.VinRightChannelMasterVolume;
    }

    outputAudio() {
        this._fillBuffer();
        if (this.bufferPosition === this.bufferLength) {
            this.device.writeAudio(this.buffer);
            this.bufferPosition = 0;
        }
        this.downSampleInput = 0;
    }

    _fillBuffer() {
        this.buffer[this.bufferPosition++] = (this.downSampleInput  >>>  16) * this.downSampleInputDivider - 1;
        this.buffer[this.bufferPosition++] = (this.downSampleInput & 0xFFFF) * this.downSampleInputDivider - 1;
    }

    _initBuffer() {
        this.audioIndex = 0;
        this.bufferPosition = 0;
        this.downSampleInput = 0;
        this.bufferContainAmount = Math.max(this.baseCyclesPerIteration * 10 / this.resamplerFirstPassFactor, 4096) << 1;
        this.bufferLength = this.baseCyclesPerIteration / this.resamplerFirstPassFactor << 1;
        this.buffer = new Float32Array(this.bufferLength);
    }

    reset() {
        this.registers.NR50._value = 0;
        this.registers.NR51._value = 0;
        this.channel1.reset();
        this.channel2.reset();
        this.channel3.reset();
        this.channel4.reset();
    }

    set volume(value) { this.device && (this.device.volume = value); }
    get volume() { return this.device && this.device.volume || 0; }
}

class Channel1 {
    /**
     * Creates a square wave channel (with sweep) (1) module for the emulator
     * @param {PAPU} papu audio processing core
     */
    constructor(papu) {

        this.papu = papu;

        let self = this;
        
        this.frequencyTracker = 0x2000;
        this.dutyTracker = 0;
        this.cachedDuty = this.papu._dutyLookup[2];
        this.totalLength = 0;
        this.envelopeVolume = 0;
        this.envelopeType = false;
        this.envelopeSweeps = 0;
        this.envelopeSweepsLast = 0;
        this.consecutive = true;
        this.frequency = 0;
        this.sweepFault = false;
        this.shadowFrequency = 0;
        this.timeSweep = 1;
        this.lastTimeSweep = 0;
        this.swept = false;
        this.frequencySweepDivider = 0;
        this.decreaseSweep = false;

        this.frequencyCounter = 0x2000;

        this.enabled = false;
        this.canPlay = false;

        this.left = 0;
        this.right = 0;
        this.currentSampleLeft = 0;
        this.currentSampleRight = 0;
        this.currentSampleLeftSecondary = 0;
        this.currentSampleRightSecondary = 0;
        this.currentSampleLeftTrimary = 0;
        this.currentSampleRightTrimary = 0;

        this.registers = {
            // FF10
            NR10: {
                _value: 0,

                set value(value) {
                    if (papu.registers.NR52.masterEnable) {
                        papu.runJIT();
                        if (self.decreaseSweep && (value & 0x8) === 0) {
                            if (self.swept) {
                                self.sweepFault = true;
                            }
                        }
                        self.lastTimeSweep = (value & 0x70) >> 4;
                        self.frequencySweepDivider = value & 0x7;
                        self.decreaseSweep = (value & 0x8) === 0x8;
                        this._value = value;
                        self.checkEnable();
                    }
                }
            },
            // FF11
            NR11: {
                _value: 0,

                set value(value) {
                    if (papu.registers.NR52.masterEnable || !papu.jsboy.gbcMode) {
                        if (papu.registers.NR52.masterEnable) {
                            papu.runJIT();
                        } else {
                            value &= 0x3F;
                        }
                        self.cachedDuty = papu._dutyLookup[value >> 6];
                        self.totalLength = 0x40 - (value & 0x3F);
                        this._value = value;
                        self.checkEnable();
                    }
                }
            },
            // FF12
            NR12: {
                _value: 0,
                set value(value) {
                    if (papu.registers.NR52.masterEnable) {
                        papu.runJIT();
                        if (self.enabled && self.envelopeSweeps === 0) {
                            if (((this._value ^ value) & 0x8) === 0x8) {
                                if ((this._value & 0x8) === 0) {
                                    if ((this._value & 0x7) === 0x7) {
                                        self.envelopeVolume += 2;
                                    } else {
                                        self.envelopeVolume++;
                                    }
                                }
                                self.envelopeVolume = 16 - self.envelopeVolume & 0xF;
                            } else if ((this._value & 0xF) === 0x8) {
                                self.envelopeVolume = 1 + self.envelopeVolume & 0xF;
                            }
                            self.cacheOutputLevel();
                        }
                        self.envelopeType = (value & 0x8) === 0x8;
                        this._value = value;
                        self.checkVolumeEnable();
                    }
                }
            },
            // FF13
            NR13: {
                _value: 0,
                set value(value) {
                    if (papu.registers.NR52.masterEnable) {
                        papu.runJIT();
                        self.frequency = self.frequency & 0x700 | value;
                        self.frequencyTracker = 0x800 - self.frequency << 2;
                    }
                }
            },
            // FF14
            NR14: {
                _value: 0,
                set value(value) {
                    if (papu.registers.NR52.masterEnable) {
                        papu.runJIT();
                        self.consecutive = (value & 0x40) === 0;
                        self.frequency = (value & 0x7) << 8 | self.frequency & 0xFF;
                        self.frequencyTracker = 0x800 - self.frequency << 2;
                        if (value > 0x7F) {
                            self.timeSweep = self.lastTimeSweep;
                            self.swept = false;
                            let nr12 = self.registers.NR12._value;
                            self.envelopeVolume = nr12 >> 4;
                            self.cacheOutputLevel();
                            self.envelopeSweepsLast = (nr12 & 0x7) - 1;
                            if (self.totalLength === 0) {
                                self.totalLength = 0x40;
                            }
                            if (self.lastTimeSweep > 0 || self.frequencySweepDivider > 0) {
                                papu.registers.NR52._value |= 1;
                            } else {
                                papu.registers.NR52._value &= 0xFE;
                            }
                            if ((value & 0x40) === 0x40) {
                                papu.registers.NR52._value |= 1;
                            }
                            self.shadowFrequency = self.frequency;
                            self.sweepFault = false;
                            self.performSweepDummy();
                        }
                        self.checkEnable();
                        this._value = value;
                    }
                }
            },
        };
    }

    clockEnvelope() {
        if (this.envelopeSweepsLast > -1) {
            if (this.envelopeSweeps > 0) {
                --this.envelopeSweeps;
            } else {
                if (!this.envelopeType) {
                    if (this.envelopeVolume > 0) {
                        --this.envelopeVolume;
                        this.envelopeSweeps = this.envelopeSweepsLast;
                        this.cacheOutputLevel();
                    } else {
                        this.envelopeSweepsLast = -1;
                    }
                } else if (this.envelopeVolume < 0xF) {
                    ++this.envelopeVolume;
                    this.envelopeSweeps = this.envelopeSweepsLast;
                    this.cacheOutputLevel();
                } else {
                    this.envelopeSweepsLast = -1;
                }
            }
        }
    }

    performSweepDummy() {
        if (this.frequencySweepDivider > 0) {
            if (this.decreaseSweep) {
                const shadowFrequency = this.shadowFrequency + (this.shadowFrequency >> this.frequencySweepDivider);
                if (shadowFrequency <= 0x7FF) {
                    if (shadowFrequency + (shadowFrequency >> this.frequencySweepDivider) > 0x7FF) {
                        this.sweepFault = true;
                        this.checkEnable();
                        this.papu.registers.NR52._value &= 0xFE;
                    }
                } else {
                    this.sweepFault = true;
                    this.checkEnable();
                    this.papu.registers.NR52._value &= 0xFE;
                }
            }
        }
    }

    clockLength() {
        if (this.totalLength > 1) {
            --this.totalLength;
        } else if (this.totalLength === 1) {
            this.totalLength = 0;
            this.checkEnable();
            this.papu.registers.NR52._value &= 0xFE;
        }
    }

    clockSweep() {
        if (!this.sweepFault && this.timeSweep > 0) {
            if (--this.timeSweep === 0) {
                this.runSweep();
            }
        }
    }

    runSweep() {
        if (this.lastTimeSweep > 0) {
            if (this.frequencySweepDivider > 0) {
                this.swept = true;
                if (this.decreaseSweep) {
                    this.shadowFrequency -= this.shadowFrequency >> this.frequencySweepDivider;
                    this.frequency = this.shadowFrequency & 0x7FF;
                    this.frequencyTracker = 0x800 - this.frequency << 2;
                } else {
                    this.shadowFrequency += this.shadowFrequency >> this.frequencySweepDivider;
                    this.frequency = this.shadowFrequency;
                    if (this.shadowFrequency <= 0x7FF) {
                        this.frequencyTracker = 0x800 - this.frequency << 2;
                        if (this.shadowFrequency + (this.shadowFrequency >> this.frequencySweepDivider) > 0x7FF) {
                            this.sweepFault = true;
                            this.checkEnable();
                            this.papu.registers.NR52._value &= 0xFE;
                        }
                    } else {
                        this.frequency &= 0x7FF;
                        this.sweepFault = true;
                        this.checkEnable();
                        this.papu.registers.NR52._value &= 0xFE;
                    }
                }
                this.timeSweep = this.lastTimeSweep;
            } else {
                this.sweepFault = true;
                this.checkEnable();
            }
        }
    }

    checkEnable() {
        this.enabled = (this.consecutive || this.totalLength > 0) && !this.sweepFault && this.canPlay;
        this.cacheOutputLevelSecondary();
    }

    cacheOutputLevel() {
        this.currentSampleLeft = this.left ? this.envelopeVolume : 0;
        this.currentSampleRight = this.right ? this.envelopeVolume : 0;
        this.cacheOutputLevelSecondary();
    }

    checkVolumeEnable() {
        this.canPlay = this.registers.NR12._value > 7;
        this.checkEnable();
        this.cacheOutputLevelSecondary();
    }

    cacheOutputLevelSecondary() {
        if (this.enabled) {
            this.currentSampleLeftSecondary = this.currentSampleLeft;
            this.currentSampleRightSecondary = this.currentSampleRight;
        } else {
            this.currentSampleLeftSecondary = 0;
            this.currentSampleRightSecondary = 0;
        }
        this.cacheOutputLevelTrimary();
    }

    cacheOutputLevelTrimary() {
        if (this.cachedDuty[this.dutyTracker]) {
            this.currentSampleLeftTrimary = this.currentSampleLeftSecondary;
            this.currentSampleRightTrimary = this.currentSampleRightSecondary;
        } else {
            this.currentSampleLeftTrimary = 0;
            this.currentSampleRightTrimary = 0;
        }
        this.papu.cacheMixerOutputLevel();
    }

    reset() {
        this.registers.NR10._value = 0;
        this.registers.NR11._value = 0;
        this.registers.NR12._value = 0;
        this.registers.NR13._value = 0;
        this.registers.NR14._value = 0;
    }

}

class Channel2 {
    /**
     * Creates a square wave channel (2) module for the emulator
     * @param {PAPU} papu audio processing core
     */
    constructor(papu) {

        this.papu = papu;

        let self = this;

        this.frequencyTracker = 0x2000;
        this.dutyTracker = 0;
        this.cachedDuty = papu._dutyLookup[2];
        this.totalLength = 0;
        this.envelopeVolume = 0;
        this.envelopeType = false;
        this.envelopeSweeps = 0;
        this.envelopeSweepsLast = 0;
        this.consecutive = true;
        this.frequency = 0;

        this.frequencyCounter = 0x2000;

        this.enabled = false;
        this.canPlay = false;

        this.left = 0;
        this.right = 0;
        this.currentSampleLeft = 0;
        this.currentSampleRight = 0;
        this.currentSampleLeftSecondary = 0;
        this.currentSampleRightSecondary = 0;
        this.currentSampleLeftTrimary = 0;
        this.currentSampleRightTrimary = 0;

        this.registers = {
            NR21: {
                _value: 0,

                set value(value) {
                    if (papu.registers.NR52.masterEnable || !papu.jsboy.gbcMode) {
                        if (papu.registers.NR52.masterEnable) {
                            papu.runJIT();
                        } else {
                            value &= 0x3F;
                        }
                        self.cachedDuty = papu._dutyLookup[value >> 6];
                        self.totalLength = 0x40 - (value & 0x3F);
                        this._value = value;
                        self.checkEnable();
                    }
                },
            },
            NR22: {
                _value: 0,
                set value(value) {
                    if (papu.registers.NR52.masterEnable) {
                        papu.runJIT();
                        if (self.enabled && self.envelopeSweeps === 0) {
                            if (((this._value ^ value) & 0x8) === 0x8) {
                                if ((this._value & 0x8) === 0) {
                                    if ((this._value & 0x7) === 0x7) {
                                        self.envelopeVolume += 2;
                                    } else {
                                        self.envelopeVolume++;
                                    }
                                }
                                self.envelopeVolume = 16 - self.envelopeVolume & 0xF;
                            } else if ((this._value & 0xF) === 0x8) {
                                self.envelopeVolume = 1 + self.envelopeVolume & 0xF;
                            }
                            self.cacheOutputLevel();
                        }
                        self.envelopeType = (value & 0x8) === 0x8;
                        this._value = value;
                        self.checkVolumeEnable();
                    }
                },
            },
            NR23: {
                _value: 0,
                set value(value) {
                    if (papu.registers.NR52.masterEnable) {
                        papu.runJIT();
                        self.frequency = self.frequency & 0x700 | value;
                        self.frequencyTracker = 0x800 - self.frequency << 2;
                    }
                },
            },
            NR24: {
                _value: 0,
                set value(value) {
                    if (papu.registers.NR52.masterEnable) {
                        papu.runJIT();
                        if (value > 0x7F) {
                            let nr22 = self.registers.NR22._value;
                            self.envelopeVolume = nr22 >> 4;
                            self.cacheOutputLevel();
                            self.envelopeSweepsLast = (nr22 & 0x7) - 1;
                            if (self.totalLength === 0) {
                                self.totalLength = 0x40;
                            }
                            if ((value & 0x40) === 0x40) {
                                papu.registers.NR52._value |= 0x2;
                            }
                        }
                        self.consecutive = (value & 0x40) === 0;
                        self.frequency = (value & 0x7) << 8 | self.frequency & 0xFF;
                        self.frequencyTracker = 0x800 - self.frequency << 2;
                        this._value = value;
                        self.checkEnable();
                    }
                },
            },
        };

    }

    clockEnvelope() {
        if (this.envelopeSweepsLast > -1) {
            if (this.envelopeSweeps > 0) {
                --this.envelopeSweeps;
            } else {
                if (!this.envelopeType) {
                    if (this.envelopeVolume > 0) {
                        --this.envelopeVolume;
                        this.envelopeSweeps = this.envelopeSweepsLast;
                        this.cacheOutputLevel();
                    } else {
                        this.envelopeSweepsLast = -1;
                    }
                } else if (this.envelopeVolume < 0xF) {
                    ++this.envelopeVolume;
                    this.envelopeSweeps = this.envelopeSweepsLast;
                    this.cacheOutputLevel();
                } else {
                    this.envelopeSweepsLast = -1;
                }
            }
        }
    }

    clockLength() {
        if (this.totalLength > 1) {
            --this.totalLength;
        } else if (this.totalLength === 1) {
            this.totalLength = 0;
            this.checkEnable();
            this.papu.registers.NR52._value &= 0xFD;
        }
    }

    checkEnable() {
        this.enabled = (this.consecutive || this.totalLength > 0) && this.canPlay;
        this.cacheOutputLevelSecondary();
    }

    cacheOutputLevel() {
        this.currentSampleLeft = this.left ? this.envelopeVolume : 0;
        this.currentSampleRight = this.right ? this.envelopeVolume : 0;
        this.cacheOutputLevelSecondary();
    }

    checkVolumeEnable() {
        this.canPlay = this.registers.NR22._value > 7;
        this.checkEnable();
        this.cacheOutputLevelSecondary();
    }

    cacheOutputLevelSecondary() {
        if (this.enabled) {
            this.currentSampleLeftSecondary = this.currentSampleLeft;
            this.currentSampleRightSecondary = this.currentSampleRight;
        } else {
            this.currentSampleLeftSecondary = 0;
            this.currentSampleRightSecondary = 0;
        }
        this.cacheOutputLevelTrimary();
    }

    cacheOutputLevelTrimary() {
        if (this.cachedDuty[this.dutyTracker]) {
            this.currentSampleLeftTrimary = this.currentSampleLeftSecondary;
            this.currentSampleRightTrimary = this.currentSampleRightSecondary;
        } else {
            this.currentSampleLeftTrimary = 0;
            this.currentSampleRightTrimary = 0;
        }
        this.papu.cacheMixerOutputLevel();
    }
    
    reset() {
        this.registers.NR21._value = 0;
        this.registers.NR22._value = 0;
        this.registers.NR23._value = 0;
        this.registers.NR24._value = 0;
    }
}

class Channel3 {
    /**
     * Creates a wave channel (3) module for the emulator
     * @param {PAPU} papu audio processing core
     */
    constructor(papu) {

        this.papu = papu;

        let self = this;

        this.envelopeVolume = 0;
        this.totalLength = 0;
        this.patternType = 4;
        this.frequency = 0;
        this.consecutive = true;
        this.counter = 0x800;
        this.frequencyPeriod = 0x800;
        this.lastSampleLookup = 0;
        this.cachedSample = 0;
        
        this.enabled = false;
        this.canPlay = false;

        this.left = 0;
        this.right = 0;
        this.currentSampleLeft = 0;
        this.currentSampleRight = 0;
        this.currentSampleLeftSecondary = 0;
        this.currentSampleRightSecondary = 0;

        this.pcm = new Int8Array(0x20);

        this.registers = {
            // FF1A
            NR30: {
                _value: 0,
                set value(value) {
                    if (papu.registers.NR52.masterEnable) {
                        papu.runJIT();
                        if (!self.canPlay && value >= 0x80) {
                            self.lastSampleLookup = 0;
                            self.cacheUpdate();
                        }
                        self.canPlay = value > 0x7F;
                        if (self.canPlay && this._value > 0x7F && self.consecutive) {
                            papu.registers.NR52._value |= 0x4;
                        }
                        this._value = value;
                    }
                },
            },
            // FF1B
            NR31: {
                _value: 0,
                set value(value) {
                    if (papu.registers.NR52.masterEnable || !papu.jsboy.gbcMode) {
                        if (papu.registers.NR52.masterEnable) {
                            papu.runJIT();
                        }
                        self.totalLength = 0x100 - value;
                        self.checkEnable();
                    }
                },
            },
            // FF1C
            NR32: {
                _value: 0,
                set value(value) {
                    if (papu.registers.NR52.masterEnable) {
                        papu.runJIT();
                        value &= 0x60;
                        this._value = value;
                        self.patternType = value === 0 ? 4 : (value >> 5) - 1;
                    }
                },
            },
            // FF1D
            NR33: {
                _value: 0,
                set value(value) {
                    if (papu.registers.NR52.masterEnable) {
                        papu.runJIT();
                        self.frequency = self.frequency & 0x700 | value;
                        self.frequencyPeriod = 0x800 - self.frequency << 1;
                    }
                },
            },
            // FF1E
            NR34: {
                _value: 0,
                set value(value) {
                    if (papu.registers.NR52.masterEnable) {
                        papu.runJIT();
                        if (value > 0x7F) {
                            if (self.totalLength === 0) {
                                self.totalLength = 0x100;
                            }
                            self.lastSampleLookup = 0;
                            if ((value & 0x40) === 0x40) {
                                papu.registers.NR52._value |= 0x4;
                            }
                        }
                        self.consecutive = (value & 0x40) === 0;
                        self.frequency = (value & 0x7) << 8 | self.frequency & 0xFF;
                        self.frequencyPeriod = 0x800 - self.frequency << 1;
                        this._value = value;
                        self.checkEnable();
                    }
                },
            },
        };
    }

    clockLength() {
        if (this.totalLength > 1) {
            this.totalLength--;
        } else if (this.totalLength === 1) {
            this.totalLength = 0;
            this.checkEnable();
            this.papu.registers.NR52._value &= 0xFB;
        }
    }

    cacheUpdate() {
        this.cachedSample = this.pcm[this.lastSampleLookup] >> this.patternType;
        this.cacheOutputLevel();
    }

    checkEnable() {
        this.enabled = this.consecutive || this.totalLength > 0;
        this.cacheOutputLevelSecondary();
    }

    cacheOutputLevel() {
        this.currentSampleLeft = this.left ? this.cachedSample : 0;
        this.currentSampleRight = this.right ? this.cachedSample : 0;
        this.cacheOutputLevelSecondary();
    }

    cacheOutputLevelSecondary() {
        if (this.enabled) {
            this.currentSampleLeftSecondary = this.currentSampleLeft;
            this.currentSampleRightSecondary = this.currentSampleRight;
        } else {
            this.currentSampleLeftSecondary = 0;
            this.currentSampleRightSecondary = 0;
        }
        this.papu.cacheMixerOutputLevel();
    }

    reset() {
        this.registers.NR30._value = 0;
        this.registers.NR31._value = 0;
        this.registers.NR32._value = 0;
        this.registers.NR33._value = 0;
        this.registers.NR34._value = 0;
    }
}

class Channel4 {
    /**
     * Creates a noise channel (4) module for the emulator
     * @param {PAPU} papu audio processing core
     */
    constructor(papu) {

        this.papu = papu;

        let self = this;

        this.frequencyPeriod = 0;
        this.totalLength = 0;
        this.envelopeVolume = 0;
        this.currentVolume = 0;
        this.envelopeType = false;
        this.envelopeSweeps = 0;
        this.envelopeSweepsLast = 0;
        this.consecutive = true;
        this.bitRange = 0x7FFF;
        this.volumeShifter = 0xF;

        this.lastSampleLookup = 0;

        this.counter = 8;
        this.cachedSample = 0;

        this.left = 0;
        this.right = 0;
        this.currentSampleLeft = 0;
        this.currentSampleRight = 0;
        this.currentSampleLeftSecondary = 0;
        this.currentSampleRightSecondary = 0;

        this.enabled = false;
        this.canPlay = false;
        
        this._initNoise();

        this.noiseSampleTable = this._lsfr15Table;

        this.registers = {
            // FF20
            NR41: {
                _value: 0,

                get lengthCounter() { return this._value & 0x3F; },

                set value(value) {
                    if (papu.registers.NR52.masterEnable || !papu.jsboy.gbcMode) {
                        if (papu.registers.NR52.masterEnable)
                            papu.runJIT();
                        //this._value = value;
                        self.totalLength = 0x40 - (value & 0x3F);
                        self.checkEnable();
                    }
                },
            },
            // FF21
            NR42: {
                _value: 0,

                get volume() { return this._value >> 4; },
                get envelopeDirection() { return (this._value >> 3) & 1; },
                get period() { return this._value & 7; },

                set value(value) {
                    if (papu.registers.NR52.masterEnable) {
                        papu.runJIT();
                        if (self.enabled && self.envelopeSweeps === 0) {
                            if (((this._value ^ value) & 0x8) === 0x8) {
                                if ((this._value & 0x8) === 0) {
                                    if ((this._value & 0x7) === 0x7) {
                                        self.envelopeVolume += 2;
                                    } else {
                                        ++self.envelopeVolume;
                                    }
                                }
                                self.envelopeVolume = 16 - self.envelopeVolume & 0xF;
                            } else if ((this._value & 0xF) === 0x8) {
                                self.envelopeVolume = 1 + self.envelopeVolume & 0xF;
                            }
                            self.currentVolume = self.envelopeVolume <<  self.volumeShifter;
                        }
                        self.envelopeType = (value & 0x08) === 0x08;
                        this._value = value;
                        self.cacheUpdate();
                        self.checkVolumeEnable();
                    }

                },
            },
            // FF22
            NR43: {
                _value: 0,

                get shiftClock() { return this._value >> 4; },
                get lfsrWidthMode() { return (this._value >> 3) & 1; },
                get dividerMode() { return this._value & 7; },

                set value(value) {
                    if (papu.registers.NR52.masterEnable) {
                        papu.runJIT();
                        self.frequencyPeriod = Math.max((value & 0x7) << 4, 8) << (value >> 4);
                        let bitWidth = value & 0x8;
                        if (bitWidth === 0x8 && self.bitRange === 0x7FFF ||
                            bitWidth === 0 && self.bitRange === 0x7F) {
                                self.lastSampleLookup = 0;
                                self.bitRange = bitWidth === 0x8 ? 0x7F : 0x7FFF;
                                self.volumeShifter = bitWidth === 0x8 ? 7 : 15;
                                self.currentVolume = self.envelopeVolume << self.volumeShifter;
                                self.noiseSampleTable = bitWidth === 0x8 ? self._lsfr7Table : self._lsfr15Table;
                        }
                        this._value = value;

                        // self.noiseTable = this.lfsrWidthMode ? self._lsfr7Table : self._lsfr15Table;
                        console.log('Changed NR43');

                    }
                },
            },
            // FF23
            NR44: {
                _value: 0,

                get trigger() { return this._value >> 7; },
                get lengthEnable() { return (this._value >> 6) & 1; },

                set value(value) {
                    if (papu.registers.NR52.masterEnable) {
                        papu.runJIT();
                        this._value = value;
                        self.consecutive = (value & 0x40) === 0;
                        if (value > 0x7F) {
                            let nr42 = self.registers.NR42._value;
                            self.envelopeVolume = nr42 >> 4;
                            self.currentVolume = self.envelopeVolume << self.volumeShifter;
                            self.envelopeSweepsLast = (nr42 & 0x7) - 1;
                            if (self.totalLength === 0) {
                                self.totalLength = 0x40;
                            }
                            if ((value & 0x40) === 0x40) {
                                papu.registers.NR52._value |= 0x8;
                            }
                        }
                        self.checkEnable();
                    }
                },
            },

        }

    }

    clockEnvelope() {
        if (this.envelopeSweepsLast > -1) {
            if (this.envelopeSweeps > 0) {
                --this.envelopeSweeps;
            } else {
                if (!this.envelopeType) {
                    if (this.envelopeVolume > 0) {
                        this.currentVolume = --this.envelopeVolume << this.volumeShifter;
                        this.envelopeSweeps = this.envelopeSweepsLast;
                        this.cacheUpdate();
                    } else {
                        this.envelopeSweepsLast = -1;
                    }
                } else if (this.envelopeVolume < 0xF) {
                    this.currentVolume = ++this.envelopeVolume << this.volumeShifter;
                    this.envelopeSweeps = this.envelopeSweepsLast;
                    this.cacheUpdate();
                } else {
                    this.envelopeSweepsLast = -1;
                }
            }
        }
    }

    clockLength() {
        if (this.totalLength > 1) {
            --this.totalLength;
        } else if (this.totalLength === 1) {
            this.totalLength = 0;
            this.checkEnable();
            this.papu.registers.NR52._value &= 0xF7;
        }
    }

    checkEnable() {
        this.enabled = (this.consecutive || this.totalLength > 0) && this.canPlay;
        this.cacheOutputLevelSecondary();
    }

    cacheUpdate() {
        this.cachedSample = this.noiseSampleTable[this.currentVolume | this.lastSampleLookup];
        this.cacheOutputLevel();
    }

    cacheOutputLevel() {
        this.currentSampleLeft = this.left ? this.cachedSample : 0;
        this.currentSampleRight = this.right ? this.cachedSample : 0;
        this.cacheOutputLevelSecondary();
    }

    checkVolumeEnable() {
        this.canPlay = this.registers.NR42._value > 7;
        this.checkEnable();
        this.cacheOutputLevelSecondary();
    }

    cacheOutputLevelSecondary() {
        if (this.enabled) {
            this.currentSampleLeftSecondary = this.currentSampleLeft;
            this.currentSampleRightSecondary = this.currentSampleRight;
        } else {
            this.currentSampleLeftSecondary = 0;
            this.currentSampleRightSecondary = 0;
        }
        this.papu.cacheMixerOutputLevel();
    }

    reset() {
        this.registers.NR41._value = 0;
        this.registers.NR42._value = 0;
        this.registers.NR43._value = 0;
        this.registers.NR44._value = 0;
    }

    _initNoise() {
        this._lsfr7Table = new Uint8Array(0x800);
        let lsfr = 0x7F;
        for (let i = 0; i < 0x80; i++) {
            const rdm = 1 - (lsfr & 1);
            this._lsfr7Table[0x080 | i] = rdm;
            this._lsfr7Table[0x100 | i] = rdm * 0x2;
            this._lsfr7Table[0x180 | i] = rdm * 0x3;
            this._lsfr7Table[0x200 | i] = rdm * 0x4;
            this._lsfr7Table[0x280 | i] = rdm * 0x6;
            this._lsfr7Table[0x300 | i] = rdm * 0x6;
            this._lsfr7Table[0x380 | i] = rdm * 0x7;
            this._lsfr7Table[0x400 | i] = rdm * 0x8;
            this._lsfr7Table[0x480 | i] = rdm * 0x9;
            this._lsfr7Table[0x500 | i] = rdm * 0xA;
            this._lsfr7Table[0x580 | i] = rdm * 0xB;
            this._lsfr7Table[0x600 | i] = rdm * 0xC;
            this._lsfr7Table[0x680 | i] = rdm * 0xD;
            this._lsfr7Table[0x700 | i] = rdm * 0xE;
            this._lsfr7Table[0x780 | i] = rdm * 0xF;
            const shiftedLsfr = lsfr >> 1;
            lsfr = shiftedLsfr | ((shiftedLsfr ^ lsfr) & 0x1) << 6;
        }
        
        this._lsfr15Table = new Uint8Array(0x80000);
        lsfr = 0x7FFF;
        for (let i = 0; i < 0x8000; i++) {
            const rdm = 1 - (lsfr & 1);
            this._lsfr15Table[0x08000 | i] = rdm;
            this._lsfr15Table[0x10000 | i] = rdm * 0x2;
            this._lsfr15Table[0x18000 | i] = rdm * 0x3;
            this._lsfr15Table[0x20000 | i] = rdm * 0x4;
            this._lsfr15Table[0x28000 | i] = rdm * 0x6;
            this._lsfr15Table[0x30000 | i] = rdm * 0x6;
            this._lsfr15Table[0x38000 | i] = rdm * 0x7;
            this._lsfr15Table[0x40000 | i] = rdm * 0x8;
            this._lsfr15Table[0x48000 | i] = rdm * 0x9;
            this._lsfr15Table[0x50000 | i] = rdm * 0xA;
            this._lsfr15Table[0x58000 | i] = rdm * 0xB;
            this._lsfr15Table[0x60000 | i] = rdm * 0xC;
            this._lsfr15Table[0x68000 | i] = rdm * 0xD;
            this._lsfr15Table[0x70000 | i] = rdm * 0xE;
            this._lsfr15Table[0x78000 | i] = rdm * 0xF;
            const shiftedLsfr = lsfr >> 1;
            lsfr = shiftedLsfr | ((shiftedLsfr ^ lsfr) & 0x1) << 14;
        }

    }

}