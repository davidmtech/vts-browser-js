
import {globals as globals_, stringToUint8Array as stringToUint8Array_ } from './worker-globals.js';

//get rid of compiler mess
const globals = globals_, stringToUint8Array = stringToUint8Array_;
var tmpVertexBuffer = new Uint8Array(65536*4*4*4*4);
var tmpVertexBuffer2 = new Uint8Array(65536*4*4*4*4);
var packedEvents = [];
var packedTransferables = [];


function postPackedMessage(message, transferables) {

    if (globals.config.mapPackLoaderEvents) {

        packedEvents.push(message);

        if (transferables) {
            packedTransferables = packedTransferables.concat(transferables);
        }

    } else {

        if (transferables) {
            postMessage(message, transferables);
        } else {
            postMessage(message);
        }
    }
}


function postGroupMessageFast(command, type, message, buffers, signature) {

    const message2 = stringToUint8Array(JSON.stringify(message));
    let messageSize = 1+1+4+message2.byteLength;

    for (let i = 0, li = buffers.length; i < li; i++) {
        messageSize += 4+buffers[i].byteLength;
    }

    const buff = new Uint8Array(messageSize);
    const view = new DataView(buff.buffer);
    let index = 0, index2 = 0;

    view.setUint8(index, command); index += 1;
    view.setUint8(index, type); index += 1;
    view.setUint32(index, message2.byteLength); index += 4;
    buff.set(message2, index); index += message2.byteLength;
    index2 = index;

    for (let i = 0, li = buffers.length; i < li; i++) {
        view.setUint32(index, buffers[i].length); index += 4;
        buff.set( new Uint8Array(buffers[i].buffer), index); index += buffers[i].byteLength;
    }

    postGroupMessageDirect(command, type, buff.buffer, index2, signature, message['hitable'], message['totalPoints'], (type == VTS_WORKER_TYPE_LINE_LABEL) ? message : null);
}


function postGroupMessageLite(command, type, number) {
    const messageSize = 1+1+4;
    let index = 0;

    const buff = new ArrayBuffer(messageSize);
    const view = new DataView(buff);

    view.setUint8(index, command); index += 1;
    view.setUint8(index, type); index += 1;
    view.setUint32(index, (number ? number : 0)); index += 4;

    postGroupMessageDirect(command, type, buff, index, "");
}


function postGroupMessageDirect(command, type, message, buffersIndex, signature, hitable, totalPoints, job2) {

    if (globals.messageBufferIndex >= globals.messageBufferSize) {
        const oldBuffer = globals.messageBuffer;
        globals.messageBufferSize += 65536;
        globals.messageBuffer = new Array(globals.messageBufferSize);

        for (let i = 0, li = globals.messageBufferIndex; i < li; i++) {
            globals.messageBuffer[i] = oldBuffer[i];
        }
    }

    globals.messageBuffer[globals.messageBufferIndex] = { command: command, type: type, job : message, buffersIndex: buffersIndex, signature: signature, hitable: hitable, totalPoints: totalPoints, job2: job2 };
    globals.messageBufferIndex++;
    globals.messagePackSize += message.byteLength;
}


function setToTmpBuffer(index, buffer2, offset) {
    let buffer = (index == 1) ? tmpVertexBuffer2 : tmpVertexBuffer;

    if (buffer.byteLength <= buffer2.byteLength + offset) {
        const buffer3 = new Uint8Array(buffer.byteLength * 2);
        buffer3.set(buffer, 0);
        buffer = buffer3;

        if (index == 1) {
            tmpVertexBuffer2 = buffer;
        } else {
            tmpVertexBuffer = buffer;
        }
    }

    buffer.set(buffer2, offset);
}


function optimizeGroupMessages() {

    //loop messages
    const messages = globals.messageBuffer;
    let j, lk, k, message2, bufferSize, buffer, view, length, index, count, totalVertices;


    for (let i = 0, li = globals.messageBufferIndex; i < li; i++) {
        const message = messages[i];
        //const job = message.job;
        const type = message.type;
        const signature = message.signature;

        //console.log('command: ' + message.command + ' type:' + message.type);

        if (!message.hitable && !message.reduced &&
            (type >= VTS_WORKER_TYPE_FLAT_LINE && type <= VTS_WORKER_TYPE_POLYGON)) {

            switch(type) {
            case VTS_WORKER_TYPE_POLYGON:
            case VTS_WORKER_TYPE_FLAT_LINE:
                count = 0;

                //get message vertices length and copy vertices to buffer
                length = (new DataView(message.job)).getUint32(message.buffersIndex) * 4;

                //tmpVertexBuffer.set(new Uint8Array(message.job, message.buffersIndex+4, length), 0);
                setToTmpBuffer(0, new Uint8Array(message.job, message.buffersIndex+4, length), 0);
                bufferSize = length;

                for (j = i + 1; j < li; j++) {
                    message2 = messages[j];

                    if (message2.signature == signature) {
                        message2.reduced = true;
                        count++;

                        //get message2 vertices length
                        length = (new DataView(message2.job)).getUint32(message2.buffersIndex) * 4;

                        // copy vertices to buffer
                        //tmpVertexBuffer.set(new Uint8Array(message2.job, message2.buffersIndex+4, length), bufferSize);
                        setToTmpBuffer(0, new Uint8Array(message2.job, message2.buffersIndex+4, length), bufferSize);
                        bufferSize += length;
                    }
                }

                if (count > 0) {

                    //create new message with merged vertices
                    buffer = new Uint8Array(message.buffersIndex+2*(4+bufferSize));
                    view = new DataView(buffer.buffer);
                    buffer.set(new Uint8Array(message.job, 0, message.buffersIndex), 0);

                    view.setUint32(message.buffersIndex, bufferSize / 4);
                    buffer.set(new Uint8Array(tmpVertexBuffer.buffer, 0, bufferSize), message.buffersIndex + 4);

                    globals.messagePackSize -= message.job.byteLength;
                    globals.messagePackSize += buffer.byteLength;
                    message.job = buffer.buffer;
                }

                break;

            case VTS_WORKER_TYPE_PIXEL_LINE:
            case VTS_WORKER_TYPE_LINE_LABEL:
            case VTS_WORKER_TYPE_FLAT_RLINE:

                count = 0;
                totalVertices = 0;

                //get message vertices length and copy vertices to buffer
                length = (new DataView(message.job)).getUint32(message.buffersIndex);
                //console.log('count: ' + count + ' totalPoints:' + message.totalPoints + ' length: ' + length);
                length *= 4;
                totalVertices += length;


                //tmpVertexBuffer.set(new Uint8Array(message.job, message.buffersIndex+4, length), 0);
                //tmpVertexBuffer2.set(new Uint8Array(message.job, message.buffersIndex+4+length+4, length), 0);
                setToTmpBuffer(0, new Uint8Array(message.job, message.buffersIndex+4, length), 0);
                setToTmpBuffer(1, new Uint8Array(message.job, message.buffersIndex+4+length+4, length), 0);
                bufferSize = length;

                for (j = i + 1; j < li; j++) {
                    message2 = messages[j];

                    if (message2.signature == signature) {
                        message2.reduced = true;
                        globals.messagePackSize -= message2.job.byteLength;
                        count++;

                        //get message2 vertices length
                        length = (new DataView(message2.job)).getUint32(message2.buffersIndex);
                        //console.log('count:' + count + ' totalPoints:' + message2.totalPoints + ' length:' + length + ' jobl:' + message2.job.byteLength + ' remaning:' + (message2.job.byteLength - (message2.buffersIndex+4)) + ' bufferSize:' + bufferSize + ' totalVertices:' + totalVertices);
                        length *= 4;

                        // eslint-disable-next-line
                        totalVertices += length;


                        // copy vertices to buffer
                        //tmpVertexBuffer.set(new Uint8Array(message2.job, message2.buffersIndex+4, length), bufferSize);
                        setToTmpBuffer(0, new Uint8Array(message2.job, message2.buffersIndex+4, length), bufferSize);

                        // copy normals to buffer
                        //tmpVertexBuffer2.set(new Uint8Array(message2.job, message2.buffersIndex+4+length+4, length), bufferSize);
                        setToTmpBuffer(1, new Uint8Array(message2.job, message2.buffersIndex+4+length+4, length), bufferSize);
                        bufferSize += length;

                        if (type == VTS_WORKER_TYPE_LINE_LABEL) {
                            const files = message.job2['files'];
                            const files2 = message2.job2['files'];

                            for (k = 0, lk = files2.length; k < lk; k++) {
                                if (!files[k]) {
                                    files[k] = [];
                                }

                                for (let m = 0, lm = files2[k].length; m < lm; m++) {
                                    if (files[k].indexOf(files2[k][m]) == -1) {
                                        files[k].push(files2[k][m]);
                                    }
                                }
                            }
                        }
                    }
                }

                if (count > 0) {

                    //create new message with merged vertices

                    if (type == VTS_WORKER_TYPE_LINE_LABEL) { //we have to rebuild header
                        const buffjob = stringToUint8Array(JSON.stringify(message.job2));

                        buffer = new Uint8Array(1+1+4+buffjob.byteLength+2*(4+bufferSize));
                        view = new DataView(buffer.buffer), index = 0;

                        view.setUint8(index, message.command); index += 1;
                        view.setUint8(index, type); index += 1;
                        view.setUint32(index, buffjob.byteLength); index += 4;
                        buffer.set(buffjob, index); index += buffjob.byteLength;

                        message.buffersIndex = index;
                    } else {
                        buffer = new Uint8Array(message.buffersIndex+2*(4+bufferSize));
                        view = new DataView(buffer.buffer);
                        buffer.set(new Uint8Array(message.job, 0, message.buffersIndex), 0);
                    }

                    view.setUint32(message.buffersIndex, bufferSize / 4);
                    buffer.set(new Uint8Array(tmpVertexBuffer.buffer, 0, bufferSize), message.buffersIndex + 4);

                    view.setUint32(message.buffersIndex + 4 + bufferSize, bufferSize / 4);
                    buffer.set(new Uint8Array(tmpVertexBuffer2.buffer, 0, bufferSize), message.buffersIndex + 4 + bufferSize + 4 );

                    globals.messagePackSize -= message.job.byteLength;
                    globals.messagePackSize += buffer.byteLength;
                    message.job = buffer.buffer;

                }

                break;
            }

        }
    }

    buffer = new Uint8Array(globals.messagePackSize);
    index = 0;

    for (let i = 0, li = globals.messageBufferIndex; i < li; i++) {
        const message = globals.messageBuffer[i];

        if (!message.reduced) {
            buffer.set(new Uint8Array(message.job), index);
            index += globals.messageBuffer[i].job.byteLength;
        }
    }

    //console.log('send:' + buffer.length);

    postPackedMessage({'command' : 'addPackedCommands', 'buffer': buffer}, [buffer.buffer]);

    globals.messageBufferIndex = 0;
    globals.messagePackSize = 0;
}


function postPackedMessages() {
    if (packedEvents.length > 0) {
        if (packedTransferables.length > 0) {
            postMessage({'command': 'packed-events', 'messages':packedEvents}, packedTransferables);
        } else {
            postMessage({'command': 'packed-events', 'messages':packedEvents});
        }

        packedEvents = [];
        packedTransferables = [];
    }
}


export {optimizeGroupMessages, postGroupMessageFast, postGroupMessageLite, postPackedMessage, postPackedMessages};
