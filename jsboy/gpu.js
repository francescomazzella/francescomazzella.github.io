const GPU_CONFIGURATION = {
    screen: {
        width: 160,
        height: 144,
    },
    tile: {
        width: 8,
        height: 8,
    },
    palette: {
        GB: {
            DBG: [ [ 0xFF, 0xFF, 0xFF, 0xFF ], [ 0xAA, 0xAA, 0xAA, 0xFF ], [ 0x55, 0x55, 0x55, 0xFF ], [ 0x00, 0x00, 0x00, 0xFF ], ],
            BG: [ [ 0x8D, 0xB5, 0xA4, 0xFF ], [ 0x6D, 0x77, 0x99, 0xFF ], [ 0x75, 0x45, 0x70, 0xFF ], [ 0x6B, 0x3B, 0x52, 0xFF ], ],
            FG: [ [ 0x00, 0x00, 0x00, 0x00 ], [ 0x6D, 0x77, 0x99, 0xFF ], [ 0x75, 0x45, 0x70, 0xFF ], [ 0x6B, 0x3B, 0x52, 0xFF ], ],
        },
    },

    cyclesPerScanline: 456,
    scanlinesPerFrame: 154,
    vBlankScanline: 144,
}

const LCDC_MODE = {
    HBlank: 0,
    VBlank: 1,
    OAMS:   2,
    TDLCD:  3,
}

class GPU {
    /**
     * Creates a new GPU module for the emulator
     * @param {JSBoy} jsboy emulation core
     * @param {HTMLElement} canvasContainer the canvas container
     */
    constructor(jsboy, canvasContainer, debugContainer) {

        this.jsboy = jsboy;

        // this._scanlineCounter = 456;

        this._scanlineCycles = 0;
        this._ly = 0;
        this._lyc = 0;

        this._stat = {
            lycInterrupt: 0,
            modeInterrupt: {
                0: 0,
                1: 0,
                2: 0,
            },

            _coincidence: 0,
            _mode: 0,
        }

        this._lcdOn = false;
        this._windowOn = false;
        this._spritesOn = false;
        this._backgroundOn = false;

        this._windowTileMap = 0;
        this._bgTileMap = 0;
        this._tileData = 0;
        this._spriteSize = 0;

        this._scrollX = 0;
        this._scrollY = 0;
        this._windowX = 0;
        this._windowY = 0;
        this._xLatch = 0;

        // this._tileset = new Array(0x180);
        // for (let i = 0; i < this._tileset.length; i++) {
        //     this._tileset[i] = new Array(8);
        //     for (let j = 0; j < 8; j++)
        //         this._tileset[i][j] = [ 0, 0, 0, 0, 0, 0, 0, 0 ];
        // }

        this._canvasContainer = canvasContainer;
        this._setupCanvas();

        if (debugContainer) {
            this._debugContainer = debugContainer;
            this._setupDebugCanvas();
        }
    }

    get state() {
        return {
            c: this._scanlineCycles,
            y: this._ly,
            yc: this._lyc,
            
            l: this._lcdOn,
            w: this._windowOn,
            p: this._spritesOn,
            b: this._backgroundOn,
            t: {
                w: this._windowTileMap,
                b: this._bgTileMap,
                d: this._tileData,
            },
            s: this._spriteSize,
            x: this._scrollX,
            y: this._scrollY,
            wx: this._windowX,
            wy: this._windowY,
            h: this._xLatch,

            a: this.stat,
        }
    }

    set state(s) {
        this._scanlineCycles = s.c;
        this._ly = s.y;
        this._lyc = s.yc;

        this._lcdOn = s.l;
        this._windowOn = s.w;
        this._spritesOn = s.p;
        this._backgroundOn = s.b;
        this._windowTileMap = s.t.w;
        this._bgTileMap = s.t.b;
        this._tileData = s.t.d;
        this._spriteSize = s.s;

        this._scrollX = s.x;
        this._scrollY = s.y;
        this._windowX = s.wx;
        this._windowY = s.wy;
        this._xLatch = s.h;

        this.stat = s.a;
    }

    set stat(value) {
        this._stat.lycInterrupt = value >> 6 & 1;
        this._stat.modeInterrupt[2] = value >> 5 & 1;
        this._stat.modeInterrupt[1] = value >> 4 & 1;
        this._stat.modeInterrupt[0] = value >> 5 & 1;
    }

    get stat() {
        return this._stat.lycInterrupt << 6 |
            this._stat.modeInterrupt[2] << 5 |
            this._stat.modeInterrupt[1] << 4 |
            this._stat.modeInterrupt[0] << 3 |
            this._stat._coincidence << 2 |
            this._stat._mode;
    }

    _setupCanvas() {
        this._mainCanvas = document.createElement('canvas');
        this._mainCanvas.width = 160;
        this._mainCanvas.height = 144;
        this._mainCanvasCtx = this._mainCanvas.getContext('2d', { alpha: false });
        this._canvasContainer.appendChild(this._mainCanvas);

        this._tmpCanvas = document.createElement('canvas');
        this._tmpCanvas.width = 160;
        this._tmpCanvas.height = 144;
        this._tmpCanvasCtx = this._tmpCanvas.getContext('2d');

        this._bgImageData = new ImageData(160, 144);
        this._fgImageData = new ImageData(160, 144);
    }

    _setupDebugCanvas() {
        this._debugCanvas = document.createElement('canvas');
        this._debugCanvas.width = 256;
        this._debugCanvas.height = 256;
        this._debugCanvasCtx = this._debugCanvas.getContext('2d');
        this._debugContainer.appendChild(this._debugCanvas);
    }

    reset() {
        
        this._scanlineCycles = 0;
        this._ly = 0;
        this._lyc = 0;

        this._lcdOn = false;
        this._windowOn = false;
        this._spritesOn = false;
        this._backgroundOn = false;

        this._windowTileMap = 0;
        this._bgTileMap = 0;
        this._tileData = 0;
        this._spriteSize = 0;

        this._scrollX = 0;
        this._scrollY = 0;
        this._windowX = 0;
        this._windowY = 0;
        this._xLatch = 0;

    }

    LCDCUpdate(data) {
        this._lcdOn = !!(data & 0x80);
        this._windowOn = !!(data & 0x20);
        this._spritesOn = !!(data & 2);
        this._backgroundOn = !!(data & 1);

        this._windowTileMap = !!(data & 0x40); // 0: 9800-9BFF - 1: 9C00-9FFF
        this._bgTileMap = !!(data & 8); // 0: 9800-9BFF - 1: 9C00-9FFF
        this._tileData = !!(data & 0x10); // 0: 8800-97FF - 1: 8000-8FFF

        this._spriteSize = !!(data & 4);
    }
/*
    update(cycles) {

        this._setLCDStatus();

        // LCD disabled if bit 7 of LCDC is 0
        if (!(this.jsboy.memory._io[0x0040] & 0x80))
            return;
        
        this._scanlineCounter -= cycles;

        if (this._scanlineCounter <= 0) {
            this._scanlineCounter += 456;

            // LY
            let currentLine = ++this.jsboy.memory._io[0x0044];

            if (currentLine == 144) {
                // Request V-Blank Interrupt by setting bit 0 of Interrupt Flag (IF)
                this.jsboy.memory._io[0x000F] |= 0b1;
            } else if (currentLine == 154) {
                // Reset LY at line 153 (end of V-Blank)
                this.jsboy.memory._io[0x0044] = 0;
            } else if (currentLine < 144) {
                // Draw current scan line
                this._drawLine(currentLine);
            }
            
        }

    }
*/
    update(cycles) {

        let vBlanked = false;

        if (this._lcdOn) {
            let oldScanlineCycles = this._scanlineCycles;
            let oldStatMode = this._stat._mode;
            
            this._scanlineCycles += cycles;

            if (this._scanlineCycles >= GPU_CONFIGURATION.cyclesPerScanline) {
                this._ly++;

                if (this._ly == GPU_CONFIGURATION.scanlinesPerFrame)
                    this._ly = 0;

                if (this._ly == GPU_CONFIGURATION.vBlankScanline) {
                    this.jsboy._requestInterrupt(INTERRUPTS.VBlank);
                    this._stat._mode = 1;
                    vBlanked = true;
                } else if (this._ly < GPU_CONFIGURATION.vBlankScanline) {
                    this._stat._mode = 2;
                } else {
                    this._stat._mode = 1;
                }

                if (this._ly == this._lyc && this._stat.lycInterrupt) {
                    this.jsboy._requestInterrupt(INTERRUPTS.LCDC);
                }

                this._scanlineCycles -= GPU_CONFIGURATION.cyclesPerScanline;
            } else if (oldScanlineCycles < 80 && this._scanlineCycles >= 80) {
                this._stat._mode = 3;
            } else if (oldScanlineCycles < 252 && this._scanlineCycles >= 252) {
                this._xLatch = this._scrollX;
                if (this._ly < GPU_CONFIGURATION.vBlankScanline) {
                    this._drawLine();
                }
                this._stat._mode = 0;
            }

            if (this._stat._mode != oldStatMode) {
                if (this._stat.modeInterrupt[this._stat._mode]) {
                    this.jsboy._requestInterrupt(INTERRUPTS.LCDC);
                }
            }
        } else {
            this._stat._mode = 1;
        }

        return vBlanked;
    }

    // updateTile(address) {
    //     address &= 0x1FFE;
    //     let tile = (address >> 4) & 511;
    //     let y = (address >> 1) & 7;
    //     let sx;
    //     for (let x = 0; x < 8; x++) {
    //         sx = 1 << (7 - x);
    //         this._tileset[tile][y][x] =
    //             ((this.jsboy.memory._vram[address    ] & sx) ? 1 : 0) +
    //             ((this.jsboy.memory._vram[address + 1] & sx) ? 2 : 0);
    //     }
    // }

    renderBackground() {
        //let imageData = new ImageData(256, 256);
        let tileDataOffset = this._tileData ? 0 : 0x1000;
        let signed = !this._tileData;
        let tileMapOffset = this._bgTileMap ? 0x1C00 : 0x1800;
        let bgp = this.jsboy.memory._io[0x0047];

        
        for (let tiley = 0; tiley < 32; tiley++) {
            for (let tilex = 0; tilex < 32; tilex++) {
                let tileIndex = this.jsboy.memory._vram[tileMapOffset + (tiley * 32) + tilex];
                if (signed) tileIndex = (tileIndex << 24 >> 24);
                tileIndex *= 16;
                let tileImageData = new ImageData(8, 8);
                for (let y = 0; y < 8; y++) {
                    let lData = this.jsboy.memory._vram[tileDataOffset + tileIndex + (y * 2)];
                    let hData = this.jsboy.memory._vram[tileDataOffset + tileIndex + (y * 2) + 1];
                    for (let x = 0; x < 8; x++) {
                        let ix = (7 - x);
                        let colorNum = ((lData >> ix) & 1) | ((hData >> ix) & 1) << 1;
                        tileImageData.data.set(GPU_CONFIGURATION.palette.GB.DBG[(bgp >> (colorNum * 2) & 3)], ((y * 8) + x) * 4);
                    }
                    this._debugCanvasCtx.putImageData(tileImageData, tilex * 8, tiley * 8);
                }
            }
        }
        /*
        for (let tiley = 0; tiley < 32; tiley++) {
            for (let tilex = 0; tilex < 32; tilex++) {
                let tileDataAddress = this.jsboy.memory._vram[tileMapOffset + ((tiley * 32) + tilex) * 16];
                if (signed) tileDataAddress = tileDataAddress << 24 >> 24;
                for (let y = 0; y < 8; y++) {
                    let data1 = this.jsboy.memory._vram[tileDataOffset + tileDataAddress + y];
                    let data2 = this.jsboy.memory._vram[tileDataOffset + tileDataAddress + y + 1];
                    for (let x = 0; x < 8; x++) {
                        let sx = 1 << (7 - x);
                        let colorNum = ((data2 >> sx) & 0b1) << 1 | ((data1 >> sx) & 0b1);
                        imageData.data.set(GPU_CONFIGURATION.palette.GB.DBG[colorNum], (((tiley * 8) * 256 + (tilex * 8)) + (y * 256) + x) * 4);
                    }
                }
            }
        }

        this._debugCanvasCtx.putImageData(imageData, 0, 0);*/
    }

    _setLCDStatus() {

        let status = this.jsboy.memory._io[0x0041];

        // LCD disabled if bit 7 of LCDC is 0
        if (!(this.jsboy.memory._io[0x0040] & 0x80)) {
            // Reset the counter
            this._scanlineCounter = 456;
            // Reset LY register
            this.jsboy.memory._io[0x0044] = 0;
            // Force V-Blank mode
            // Reset bit 1 in LCDC STAT, set bit 0 in LCDC STAT (result 1)
            status &= ~2;
            status |= 1;
            // Save to IO memory
            this.jsboy.memory._io[0x0041] = status;
            return;
        }

        let currentLine = this.jsboy.memory._io[0x0044];
        let prevMode = status & 0x3;

        let mode = 0;
        let interrupt = 0;

        if (currentLine >= 144) {
            // V-Blank
            mode = 1;
            // Reset bit 1 in LCDC STAT, set bit 0 in LCDC STAT (result 1)
            status &= ~2;
            status |= 1;
            // Check if V-Blank interrupt is enabled (bit 4)
            interrupt = status & 0b10000;
        } else {
            if (this._scanlineCounter >= 376) { // 456 - 80
                // Searching OAM-RAM
                mode = 2;
                // Reset bit 0 in LCDC STAT, set bit 1 in LCDC STAT (result 2)
                status &= ~1;
                status |= 2;
                // Check if OAM Searching interrupt is enabled (bit 5)
                interrupt = status & 0b100000;
            } else if (this._scanlineCounter >= 204) { // 456 - 80 - 172
                // Transferring Data to LCD Driver
                mode = 3;
                // Set bits 0-1 in LCDC STAT (result 3)
                status |= 3;
            } else {
                // H-Blank
                mode = 0;
                // Reset bits 0-1 in LCDC STAT (result 0)
                status &= ~3;
                // Check if LCD Data Transfer interrupt is enabled (bit 3)
                interrupt = status & 0b1000;
            }
        }

        if (mode != prevMode) {
            this._xLatch = this._scrollX;
        }

        if (interrupt && (mode != prevMode)) {
            // Mode changed: request LCDC interrupt
            this.jsboy.memory._io[0x000F] |= 0b10;
        }

        if (this.jsboy.memory._io[0x0044] == this.jsboy.memory._io[0x0045]) {
            // Coincidence Flag
            status |= 4;
            if (status & 0b1000000) {
                // Coincidence Interrupt enabled
                this.jsboy.memory._io[0x000F] |= 0b10;
            }
        } else {
            // No Coincidence
            status &= ~4;
        }

        // Save to IO memory
        this.jsboy.memory._io[0x0041] = status;
    }
/*
    _drawLine() {
        let ly = this.jsboy.memory._io[0x0044];
        if (this._backgroundOn) {
            // BG & Windows Display
            this._drawTiles(ly);
        }
        if (this._spritesOn) {
            // OBJ Display
            this._drawSprites();
        }
    }
*/
    _drawLine() {
        let screenOffset = this._ly * 160;

        let sprites = this._spritesInLine(this._ly);

        for (let i = 0; i < 160; i++) {
            let bgPaletteIndex = 0;
            if (this._windowOn && (i >= this._windowX - 7) && (this._windowY <= this._ly)) {
                bgPaletteIndex = this._windowPixel(i, this._ly);
            } else if (this._backgroundOn) {
                bgPaletteIndex = this._backgroundPixel(i, this._ly);
            }
            
            let spriteColor = null;
            let spritePriority = false;
            if (this._spritesOn) {
                [ spriteColor, spritePriority ] = this._spritePixel(i, this._ly, sprites);
            }

            let bgp = this.jsboy.memory._io[0x0047];
            let finalColor = GPU_CONFIGURATION.palette.GB.BG[(bgp >> (bgPaletteIndex << 1) & 3)]; // << 1 -> * 2

            if (spriteColor != null) {
                if (spritePriority || bgPaletteIndex == 0)
                    finalColor = spriteColor;
            }

            this._bgImageData.data.set(finalColor, (screenOffset + i) << 2); // << 2 -> * 4
        }
    }

    _backgroundPixel(x, y) {
        x = (x + this._xLatch) % 256;
        y = (y + this._scrollY) % 256;
        let idCoord = ((y >> 3) << 5) + (x >> 3); // >> 3 -> / 8 || << 5 -> * 32
        idCoord += (this._bgTileMap ? 0x1c00 : 0x1800);
        let tileNumber = this.jsboy.memory._vram[idCoord];
        let tileCoord =
            (!this._tileData ?
                (0x1000 + ((tileNumber << 24 >> 24) << 4)) : // << 4 -> * 16
                (0x0000 + (tileNumber << 4)));

        let tileX = x % 8;
        let tileY = y % 8;

        let lData = this.jsboy.memory._vram[tileCoord + (tileY << 1)]; // << 1 -> * 2
        let hData = this.jsboy.memory._vram[tileCoord + (tileY << 1) + 1];
        return ((lData >> (7 - tileX)) & 1) | (((hData >> (7 - tileX)) & 1) << 1);
    }

    _windowPixel(x, y) {
        y -= this._windowY;
        let idCoord = ((y >> 3) << 5) + (x >> 3); // >> 3 -> / 8 || << 5 -> * 32
        idCoord += (this._windowTileMap ? 0x1c00 : 0x1800);
        let tileNumber = this.jsboy.memory._vram[idCoord];
        let tileCoord =
            (!this._tileData ?
                (0x1000 + ((tileNumber << 24 >> 24) << 4)) : // << 4 -> * 16
                (0x0000 + (tileNumber << 4)));

        let tileX = x % 8;
        let tileY = y % 8;

        let lData = this.jsboy.memory._vram[tileCoord + (tileY << 1)]; // << 1 -> * 2
        let hData = this.jsboy.memory._vram[tileCoord + (tileY << 1) + 1];
        return ((lData >> (7 - tileX)) & 1) | (((hData >> (7 - tileX)) & 1) << 1);
    }

    _spritePixel(x, y, sprites) {
        let height = this._spriteSize ? 16 : 8;

        for (let i = 0; i < sprites.length; i++) {
            let index = sprites[i] << 2; // * 4
            let posY = this.jsboy.memory._oam[index    ] - 16;
            let posX = this.jsboy.memory._oam[index + 1] - 8;
            
            if (x < posX || x >= posX + 8)
                continue;

            let iden = this.jsboy.memory._oam[index + 2];
            let attr = this.jsboy.memory._oam[index + 3];

            let flipX = attr & 0x20;
            let flipY = attr & 0x40;

            if (this._spriteSize) {
                iden &= 0xFE;
                let upperTile = (y - posY) < 8;
                if ((!flipY && !upperTile) || (flipY && upperTile))
                    iden++;
            }

            iden <<= 4;

            let tileX = (x - posX) % 8;
            let tileY = (y - posY) % 8;

            // X flip flag
            if (flipX)
                tileX = 7 - tileX;
            // Y flip flag
            if (flipY)
                tileY = 7 - tileY;

    
            let lData = this.jsboy.memory._vram[iden + (tileY << 1)    ]; // << 1 -> * 2
            let hData = this.jsboy.memory._vram[iden + (tileY << 1) + 1];
            let paletteIndex = ((lData >> (7 - tileX)) & 1) | (((hData >> (7 - tileX)) & 1) << 1);

            let palette = this.jsboy.memory._io[((attr >> 4) & 1) ? 0x0049 : 0x0048];
            
            // Skip 0 as it is transparent
            if (!paletteIndex)
                continue;
            
            let finalColor = GPU_CONFIGURATION.palette.GB.BG[(palette >> (paletteIndex << 1) & 3)]; // << 1 -> * 2

            let priority = (attr >> 7) & 1; // 0: priority

            return [ finalColor, !priority ];
        }

        return [ null, null ];
    }

    _spritesInLine(y) {
        let height = this._spriteSize ? 16 : 8;
        let sprites = [];
        let lastX = 80;

        for (let spr = 0; spr < 40 && sprites.length <= 10; spr++) {
            let index = spr << 2; // * 4
            let posY = this.jsboy.memory._oam[index    ] - 16;
            let posX = this.jsboy.memory._oam[index + 1] - 8;
            
            if (y >= posY && y < posY + height) {
                if (posX > lastX)
                    sprites.push(spr);
                else
                    sprites.unshift(spr);
                lastX = posX;
            }
        }

        return sprites;
    }
/*
    _drawTiles() {

        let tileData = 0;
        let backgroundMemory = 0;
        let unsigned = true;

        let lcdc = this.jsboy.memory._io[0x0040];
        let ly = this.jsboy.memory._io[0x0044];

        let scrollY = this.jsboy.memory._io[0x0042];
        let scrollX = this.jsboy.memory._io[0x0043];
        let windowY = this.jsboy.memory._io[0x004A];
        let windowX = this.jsboy.memory._io[0x004B] - 7;

        // Get color palette from BGP
        let bgp = this.jsboy.memory._io[0x0047];
        let palette = [
            GPU_CONFIGURATION.palette.GB.BG[(bgp     ) & 0b11],
            GPU_CONFIGURATION.palette.GB.BG[(bgp >> 2) & 0b11],
            GPU_CONFIGURATION.palette.GB.BG[(bgp >> 4) & 0b11],
            GPU_CONFIGURATION.palette.GB.BG[(bgp >> 6) & 0b11],
        ];

        let usingWindow = false;

        // Is window is Enabled (bit 5) and is LY within windowY
        if ((lcdc & 0b100000) && (windowY <= ly)) {
            usingWindow = true;
        }

        if (lcdc & 0b10000) {
            // Using 0x8000 tile data
            tileData = 0x0000;
        } else {
            // Using 0x8800 tile data
            // Signed Byte
            tileData = 0x0800;
            unsigned = false;
        }

        // Current vertical pixel of the tile
        let ypos = 0;

        // Select background memory - Window Enabled ? Bit 6 : Bit 3
        if (usingWindow) {
            backgroundMemory = lcdc & 0x40 ? 0x1C00 : 0x1800;
            ypos = ly - windowY;
        } else {
            backgroundMemory = lcdc & 0x8  ? 0x1C00 : 0x1800;
            ypos = scrollY + ly;
        }

        // Calculate vertical tile currently drawing
        let tileRow = ((ypos / 8) | 0) * 32;

        for (let pixel = 0; pixel < 160; pixel++) {

            if (ly < 0 || ly > 144 || pixel < 0 || pixel > 159)
                continue;

            // Translate posx to window space if needed
            let xpos = (usingWindow && pixel >= windowX) ? pixel - windowX : pixel + scrollX;

            // Calculate horizontal tile
            let tileCol = (xpos / 8) | 0;

            // Calculate Tile Address and fetch Tile Number
            let tileNum = this.jsboy.memory._vram[(backgroundMemory + tileRow + tileCol)];
            if (!unsigned) tileNum = tileNum << 24 >> 24;

            // 128 is signed offset, 16 is tile size in memory
            let tileLocation = tileData + (unsigned ? (tileNum * 16) : ((tileNum + 128) * 16));
            
            // Find the line we're on
            // << 1 multiplicates by 2 since each vertical line takes 2 bytes of memory
            let line = (ypos % 8) << 1;
            // Get pixel data
            let data1 = this.jsboy.memory._vram[(tileLocation + line    )];
            let data2 = this.jsboy.memory._vram[(tileLocation + line + 1)];

            // Pixel 0 is in bit 7
            let colorBit = ((xpos % 8) - 7) * -1;

            // Combine data
            let colorNum = ((data2 >> colorBit) & 0b1) << 1 | ((data1 >> colorBit) & 0b1);

            this._bgImageData.data.set(palette[colorNum], (pixel + (ly * 160)) * 4);
        }

    }
/*
    _drawTiles() {
        let mapOffset = this._bgTileMap ? 0x1C00 : 0x1800;
        mapOffset += (((this.jsboy.memory._io[0x0044] + this.jsboy.memory._io[0x0042]) & 0xFF) >> 3) << 5;
        let lineOffset = (this.jsboy.memory._io[0x0043] >> 3) & 31;
        let y = (this.jsboy.memory._io[0x0044] + this.jsboy.memory._io[0x0042]) & 7;
        let x = this.jsboy.memory._io[0x0043] & 7;
        let canvasOffset = this.jsboy.memory._io[0x0044] * 160 * 4;
        let tile = this.jsboy.memory._vram[mapOffset + lineOffset];
        if (this._tileData && tile < 128) tile += 256;
        for (let i = 0; i < 160; i++) {
            this._bgImageData.data.set(GPU_CONFIGURATION.palette.GB.BG[this._tileset[tile][y][x]], canvasOffset);
            canvasOffset += 4;
            x++;
            if (x == 8) {
                x = 0;
                lineOffset = (lineOffset + 1) & 31;
                tile = this.jsboy.memory._vram[mapOffset + lineOffset];
                if (this._tileData && tile < 128) tile += 256;
            }
        }
    }
*/
    _drawSprites() {
        // LCDC Bit 2 - 0: 8*8 - 1: 8*16
        let size = this.jsboy.memory._io[0x0040] & 4;
        let ly = this.jsboy.memory._io[0x0044];
        
        // Get color palette from OBP0
        let obp0 = this.jsboy.memory._io[0x0048];
        let palette0 = [
            GPU_CONFIGURATION.palette.GB.BG[(obp0     ) & 0b11],
            GPU_CONFIGURATION.palette.GB.BG[(obp0 >> 2) & 0b11],
            GPU_CONFIGURATION.palette.GB.BG[(obp0 >> 4) & 0b11],
            GPU_CONFIGURATION.palette.GB.BG[(obp0 >> 6) & 0b11],
        ];
        // Get color palette from OBP1
        let obp1 = this.jsboy.memory._io[0x0049];
        let palette1 = [
            GPU_CONFIGURATION.palette.GB.FG[(obp1     ) & 0b11],
            GPU_CONFIGURATION.palette.GB.FG[(obp1 >> 2) & 0b11],
            GPU_CONFIGURATION.palette.GB.FG[(obp1 >> 4) & 0b11],
            GPU_CONFIGURATION.palette.GB.FG[(obp1 >> 6) & 0b11],
        ];

        for (let sprite = 0; sprite < 40; sprite++) {
            let i = sprite * 4; // 4 Bytes per sprite
            let ypos = this.jsboy.memory._oam[i    ] - 16;
            let xpos = this.jsboy.memory._oam[i + 1] - 8;
            let loc  = this.jsboy.memory._oam[i + 2];
            let attr = this.jsboy.memory._oam[i + 3];

            let palette = ((attr & 0x10) ? palette1 : palette0);

            let yflip = attr & 0x40;
            let xflip = attr & 0x20;

            let h = size ? 16 : 8;

            // Is sprite part of this scanline
            if ((ly >= ypos) && (ly < (ypos + h))) {

                let line = ly - ypos;
                if (yflip) line = -(line - h);
                line *= 2;

                if (line < 0 || line > 143)
                    continue;

                let address = (loc * 16) + line;
                let data1 = this.jsboy.memory._vram[address];
                let data2 = this.jsboy.memory._vram[address + 1];

                for (let x = 7; x >= 0; x--) {

                    let pixel = xpos + (-x + 7);
                    
                    if (pixel < 0 || pixel > 159)
                        continue;

                    let p = (xflip ? -(x - 7) : x);
                    let color = ((data2 >> p) & 1) << 1 | ((data1 >> p) & 1);

                    if (!color) continue;

                    this._fgImageData.data.set(palette[color], (pixel + (ly * 160)) * 4);
                }
            }
        }
    }

    render() {
        //this._mainCanvasCtx.clearRect(0, 0, 160, 144);

        this._mainCanvasCtx.putImageData(this._bgImageData, 0, 0);

        this._tmpCanvasCtx.putImageData(this._fgImageData, 0, 0);
        this._mainCanvasCtx.drawImage(this._tmpCanvas, 0, 0);

        this._fgImageData.data.fill(0);
    }
}