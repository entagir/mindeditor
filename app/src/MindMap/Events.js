import { v4 as uuid } from 'uuid';
import { DEBUG, mindFilesRemote } from "../index";
import { sendEventForRemoteFile } from '../Net'

class EventsClass {
    generate(eventType, mindFile, options) {
        if (eventType === 'load') {
            this._load(mindFile, options);
        }
        
        if (eventType === 'move') {
            this._move(mindFile, options);
        }

        if (eventType === 'rename') {
            this._rename(mindFile, options);
        }

        if (eventType === 'add') {
            this._add(mindFile, options);
        }

        if (eventType === 'remove') {
            this._remove(mindFile, options);
        }

        if (eventType === 'color') {
            this._color(mindFile, options);
        }

        if (eventType === 'transplant') {
            this._transplant(mindFile, options);
        }

        if (eventType === 'file_rename') {
            this._file_rename(mindFile, options);
        }

        if (DEBUG) {
            console.log('[Events generate]', mindFile.events);
        }

        if (mindFile.id && mindFilesRemote[mindFile.id]) {
            sendEventForRemoteFile(mindFile, mindFile.events[mindFile.events.length - 1]);
        }
    }

    _load(mindFile, options) {
        mindFile.events.push({
            id: uuid(),
            type: 'load',
            content: options.content,
            user: options.user
        });
    }

    _move(mindFile, options) {
        mindFile.events.push({
            id: uuid(),
            type: 'move',
            node: options.id,
            x: options.x,
            y: options.y,
            joint: options.joint,
            user: options.user,
        });
    }

    _rename(mindFile, options) {
        mindFile.events.push({
            id: uuid(),
            type: 'rename',
            node: options.id,
            name: options.name,
            user: options.user
        });
    }

    _add(mindFile, options) {
        mindFile.events.push({
            id: uuid(),
            type: 'add',
            node: options.id,
            parent: options.parent,
            joint: options.joint,
            x: options.x,
            y: options.y,
            color: options.color,
            user: options.user
        });
    }

    _remove(mindFile, options) {
        mindFile.events.push({
            id: uuid(),
            type: 'remove',
            node: options.id,
            user: options.user
        });
    }

    _color(mindFile, options) {
        mindFile.events.push({
            id: uuid(),
            type: 'color',
            node: options.id,
            color: options.color,
            user: options.user
        });
    }

    _transplant(mindFile, options) {
        mindFile.events.push({
            id: uuid(),
            type: 'transplant',
            node: options.id,
            parent: options.parent,
            user: options.user
        });
    }

    _file_rename(mindFile, options) {
        mindFile.events.push({
            id: uuid(),
            type: 'file_rename',
            name: options.name,
            user: options.user
        });
    }
}

export const Events = new EventsClass();