const AudioContextClass = typeof window !== "undefined" ? (typeof AudioContext !== "undefined" ? AudioContext : window.webkitAudioContext) : null;

class AudioDevice {

    /**
     * Helper to resample and ouput audio
     * @param {AudioContext} context the AudioContext
     * @param {number} channels number of channels
     * @param {number} minBufferSize minimum buffer size
     * @param {number} volume initial volume
     */
    constructor(context = undefined, channels = 2, minBufferSize = undefined, volume = 1) {
        /** @type {AudioContext} */
        this.context = context || new AudioContextClass();
        /** Number of channels
         * @type {number} */
        this.channels = Math.max(channels, 1);
        this.samplesPerCallback = 2048;
        this.bufferSize = this.samplesPerCallback * this.channels;
        this.minBufferSize = minBufferSize || this.bufferSize;
        this.volume = volume;
    }

    async init() {
        this.audioNode = this.context.createScriptProcessor(this.samplesPerCallback, 0, this.channels);
        this.audioNode.onaudioprocess = e => this._processAudio(e);
        this.audioNode.connect(this.context.destination);
        
        this.audioBufferSize = this.resampleBufferEnd = this.resampleBufferStart = 0;
        this._initResampler();
        this.resampledBuffer = new Float32Array(this.resampleBufferSize);
    }

    _initResampler() {
        this.audioContextSampleBuffer = new Float32Array(this.maxBufferSize);
        this.resampleBufferSize = Math.max(
            this._maxBufferSize * Math.ceil(this.context.sampleRate / this._sampleRate) + this.channels,
            this.bufferSize
        );
        this.resampler = new Resampler(this.sampleRate, this.context.sampleRate, this.channels, this.resampleBufferSize, true);
    }

    _processAudio(e) {
        const channels = [];
        let channel = 0;

        while (channel < this.channels) {
            channels[channel] = e.outputBuffer.getChannelData(channel);
            channel++;
        }

        this._refillResampledBuffer();

        let index = 0;
        while (index < this.samplesPerCallback && this.resampleBufferStart !== this.resampleBufferEnd) {
            channel = 0;
            while (channel < this.channels) {
                channels[channel][index] = this.resampledBuffer[this.resampleBufferStart++] * this._volume;
                channel++;
            }

            if (this.resampleBufferStart === this.resampleBufferSize) {
                this.resampleBufferStart = 0;
            }

            index++;
        }

        while (index < this.samplesPerCallback) {
            for (channel = 0; channel < this.channels; ++channel) {
                channels[channel][index] = 0;
            }
            index++;
        }
    }

    _refillResampledBuffer() {
        if (this.audioBufferSize > 0) {
            const resampleLength = this.resampler.resampler(this.bufferSamples);
            const resampledResult = this.resampler.outputBuffer;

            for (let i = 0; i < resampleLength;) {
                this.resampledBuffer[this.resampleBufferEnd++] = resampledResult[i++];

                if (this.resampleBufferEnd === this.resampleBufferSize)
                    this.resampleBufferEnd = 0;
                    
                if (this.resampleBufferStart === this.resampleBufferEnd) {
                    this.resampleBufferStart += this.channels;

                    if (this.resampleBufferStart === this.resampleBufferSize) {
                        this.resampleBufferStart = 0;
                    }
                }
            }
            this.audioBufferSize = 0;
        }
    }

    /** @param {number} value */
    set volume(value) { this._volume = Math.max(0, Math.min(1, value)); }
    get volume() { return this._volume; }

    /** @param {number} value */
    set sampleRate(value) { this._sampleRate = Math.abs(value); }
    get sampleRate() { return this._sampleRate; }

    /** @param {number} value */
    set maxBufferSize(value) {
        this._maxBufferSize =
            ((value | 0) > this.minBufferSize + this.channels) ?
                value & -this.channels :
                this.minBufferSize * this.channels;
    }
    get maxBufferSize() { return this._maxBufferSize; }

    get remainingBuffer() {
        return ((this.resampledSamplesLeft * this.resampler.ratioWeight / this.channels) | 0) * this.channels + this.audioBufferSize;
    }

    get resampledSamplesLeft() {
        return (this.resampleBufferStart <= this.resampleBufferEnd ? 0 : this.resampleBufferSize) +
            this.resampleBufferEnd - this.resampleBufferStart;
    }

    get bufferSamples() { return this.audioContextSampleBuffer.subarray(0, this.audioBufferSize); }

    /**
     * Write the audio to be resampled and outputted
     * @param {Array} buffer the audio data
     */
    writeAudio(buffer) {
        let bufferCounter = 0;
        while (bufferCounter < buffer.length && this.audioBufferSize < this.maxBufferSize) {
            this.audioContextSampleBuffer[this.audioBufferSize++] = buffer[bufferCounter++];
        }
    }

    

}


class Resampler {
    constructor(sourceSampleRate, targetSampleRate, channelNumber, outputBufferSize, noReturn) {
        this.sourceSampleRate = sourceSampleRate;
        this.targetSampleRate = targetSampleRate;
        this.channels = channelNumber | 0;
        this.outputBufferSize = outputBufferSize;
        this.noReturn = !!noReturn;
        this._init();
    }

    _init() {
        this.ratioWeight = this.sourceSampleRate / this.targetSampleRate;
        if (this.sourceSampleRate < this.targetSampleRate) {
            this.compileLinearInterpolationFunction();
            this.lastWeight = 1;
        } else {
            this.compileMultiTapFunction();
            this.tailExists = false;
            this.lastWeight = 0;
        }

        this.outputBuffer = new Float32Array(this.outputBufferSize);
        this.lastOutput = new Float32Array(this.channels);
    }
    
    compileLinearInterpolationFunction() {
        var toCompile = `var bufferLength = buffer.length;
        var outLength = this.outputBufferSize;
        if ((bufferLength % ` + this.channels + `) === 0) {
            if (bufferLength > 0) {
                var weight = this.lastWeight;
                var firstWeight = 0;
                var secondWeight = 0;
                var sourceOffset = 0;
                var outputOffset = 0;
                var outputBuffer = this.outputBuffer;
                for (; weight < 1; weight += ` + this.ratioWeight + `) {
                    secondWeight = weight % 1;
                    firstWeight = 1 - secondWeight;`;
        for (let channel = 0; channel < this.channels; ++channel) {
            toCompile += `outputBuffer[outputOffset++] = (this.lastOutput[${channel}] * firstWeight) + (buffer[${channel}] * secondWeight);`;
        }
        toCompile += `}
                weight -= 1;
                for (bufferLength -= ` + this.channels + ", sourceOffset = Math.floor(weight) * " + this.channels + `; outputOffset < outLength && sourceOffset < bufferLength;) {
                    secondWeight = weight % 1;
                    firstWeight = 1 - secondWeight;`;
        for (let channel = 0; channel < this.channels; ++channel) {
            toCompile += "outputBuffer[outputOffset++] = (buffer[sourceOffset" + (channel > 0 ? " + " + channel : "") + "] * firstWeight) + (buffer[sourceOffset + " + (this.channels + channel) + "] * secondWeight);";
        }
        toCompile += "weight += " + this.ratioWeight + "; sourceOffset = Math.floor(weight) * " + this.channels + "; }";
        for (let channel = 0; channel < this.channels; ++channel) {
            toCompile += "this.lastOutput[" + channel + "] = buffer[sourceOffset++];";
        }
        toCompile += `this.lastWeight = weight % 1;
                return this.bufferSlice(outputOffset);
            }
            else {
                return (this.noReturn) ? 0 : [];
            }
        }
        else {
            throw(new Error("Buffer was of incorrect sample length."));
        }`;
        this.resampler = Function("buffer", toCompile);
    }
    compileMultiTapFunction() {
        var toCompile = `var bufferLength = buffer.length;
        var outLength = this.outputBufferSize;
        if ((bufferLength % ` + this.channels + `) === 0) {
            if (bufferLength > 0) {
                var weight = 0;`;
        for (let channel = 0; channel < this.channels; ++channel) {
            toCompile += "var output" + channel + " = 0;";
        }
        toCompile += `var actualPosition = 0;
                var amountToNext = 0;
                var alreadyProcessedTail = !this.tailExists;
                this.tailExists = false;
                var outputBuffer = this.outputBuffer;
                var outputOffset = 0;
                var currentPosition = 0;
                do {
                    if (alreadyProcessedTail) {
                        weight = ` + this.ratioWeight + ";";
        for (let channel = 0; channel < this.channels; ++channel) {
            toCompile += "output" + channel + " = 0;";
        }
        toCompile += `}
                    else {
                        weight = this.lastWeight;`;
        for (let channel = 0; channel < this.channels; ++channel) {
            toCompile += "output" + channel + " = this.lastOutput[" + channel + "];";
        }
        toCompile += `alreadyProcessedTail = true;
                    }
                    while (weight > 0 && actualPosition < bufferLength) {
                        amountToNext = 1 + actualPosition - currentPosition;
                        if (weight >= amountToNext) {`;
        for (let channel = 0; channel < this.channels; ++channel) {
            toCompile += "output" + channel + " += buffer[actualPosition++] * amountToNext;";
        }
        toCompile += `currentPosition = actualPosition;
                            weight -= amountToNext;
                        }
                        else {`;
        for (let channel = 0; channel < this.channels; ++channel) {
        toCompile += "output" + channel + " += buffer[actualPosition" + (channel > 0 ? " + " + channel : "") + "] * weight;";
        }
        toCompile += `currentPosition += weight;
                            weight = 0;
                            break;
                        }
                    }
                    if (weight <= 0) {`;
        for (let channel = 0; channel < this.channels; ++channel) {
        toCompile += "outputBuffer[outputOffset++] = output" + channel + " / " + this.ratioWeight + ";";
        }
        toCompile += `
        } else {
                this.lastWeight = weight;`;
        for (let channel = 0; channel < this.channels; ++channel) {
        toCompile += "this.lastOutput[" + channel + "] = output" + channel + ";";
        }
        toCompile += `this.tailExists = true;
                        break;
                    }
                } while (actualPosition < bufferLength && outputOffset < outLength);
                return this.bufferSlice(outputOffset);
            }
            else {
                return (this.noReturn) ? 0 : [];
            }
        }
        else {
            throw(new Error("Buffer was of incorrect sample length."));
        }`;
        this.resampler = Function("buffer", toCompile);
    }

    bufferSlice(sliceAmount) {
        if (this.noReturn) {
            return sliceAmount;
        } else {
            return this.outputBuffer.subarray(0, sliceAmount);
        }
    }
}
