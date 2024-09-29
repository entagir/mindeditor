import { DEBUG, user, updateMindFileHandler, updateMindFileEventHandler, updateMindFileUsersHandler, doneMindFileEventHandler } from './index'
const Config = require('./Config.json')

export async function insertRemoteFile(mindFile) {
    const bodyJSON = {
        name: mindFile.name,
    };

    try {
        const response = await fetch(`${Config.scheme}://${Config.host}/api/mindmap`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': user.session
            },
            body: JSON.stringify(bodyJSON)
        });

        if (response.status === 201) {
            const pay = await response.json();
            if (pay.id) {
                mindFile.id = pay.id;
                mindFile.userId = user.id;
                mindFile.timestampEvent = pay.timestamp;
                mindFile.onSaved = true;

                // TODO: send events packages (REST)
                for (const event of mindFile.events) {
                    sendEventForRemoteFile(mindFile, event);
                }
            }
        } else {
            //console.error(response.status);
        }
    } catch (error) {
        //console.error('err: ', error.message);
    }
}

export async function updateRemoteFile(mindFile, file) {
    const bodyJSON = {
        name: mindFile.name,
        content: JSON.stringify(file)
    };

    try {
        const response = await fetch(`${Config.scheme}://${Config.host}/api/mindmap/${mindFile.id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': user.session
            },
            body: JSON.stringify(bodyJSON),
        });

        if (response.status === 200) {
            const pay = await response.json();
            if (pay.timestamp) {
                mindFile.timestampEvent = pay.timestamp;
                mindFile.onSaved = true;
            }
        } else {
            //console.error(response.status);
        }
    } catch (error) {
        //console.error('err: ', error.message);
    }
}

export async function getRemoteFile(id) {
    try {
        const response = await fetch(`${Config.scheme}://${Config.host}/api/mindmap/${id}`);

        if (response.status === 200) {
            return await response.json();
        } else {
            //console.error(response.status);
        }
    } catch (error) {
        console.error('err: ', error.message);
    }
}

export async function getRemoteFileEvents(id, options={}) {
    try {
        const response = await fetch(`${Config.scheme}://${Config.host}/api/mindmap/events/${id}?min=${options.min || ""}`);

        if (response.status === 200) {
            return await response.json();
        } else {
            //console.error(response.status);
        }
    } catch (error) {
        console.error('err: ', error.message);
    }
}

export async function deleteRemoteFile(mindFile) {
    try {
        const response = await fetch(`${Config.scheme}://${Config.host}/api/mindmap/${mindFile.id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': user.session
            }
        });

        if (response.status === 200) {
            mindFile.id = null;
            mindFile.onSaved = false;
        } else {
            //console.error(response.status);
        }
    } catch (error) {
        //console.error('err: ', error.message);
    }
}

export async function subscribeToRemoteFile(mindFile) {
    const socket = await socketManager.getSocket();

    socket.send(JSON.stringify({
        "action": "subscribe",
        "fileId": mindFile.id
    }));
}

export async function unsubscribeFromRemoteFile(mindFile) {
    const socket = await socketManager.getSocket();

    socket.send(JSON.stringify({
        "action": "unsubscribe",
        "fileId": mindFile.id
    }));
}

export async function sendEventForRemoteFile(mindFile, event) {
    const socket = await socketManager.getSocket();

    socket.send(JSON.stringify({
        "action": "update",
        "fileId": mindFile.id,
        "data": JSON.stringify(event)
    }));
}

export async function getRemoteFilesList() {
    if (!user.id || !user.session) return {};

    try {
        const response = await fetch(`${Config.scheme}://${Config.host}/api/mindmap`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': user.session
            },
        });
    
        if (response.status === 200) {
            return await response.json();
        } else {
            //console.error(response.status);
            return {err: response.status};
        }
    } catch (err) {
        //console.error('err: ', error.message);
        return {err: err};
    }
}

export async function logout() {
    fetch(`${Config.scheme}://${Config.host}/api/logout`, {
        method: 'POST',
        headers: {
            'Authorization': user.session
        }
    });
}

export async function login(login, password) {
    if (!login.length && !password.length) {
        return {};
    }

    const bodyJSON = {
        login: login,
        password: password
    };

    try {
        const response = await fetch(`${Config.scheme}://${Config.host}/api/signin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bodyJSON)
        });

        if (response.status === 200) {
            const pay = await response.json();
            return pay;
        } else {
            //console.error(response.status);
            return {err: response.status};
        }
    } catch (err) {
        //console.error('err: ', err.message);
        return {err};
    }
}

export async function register(login, password) {
    if (!login.length && !password.length) {
        return {};
    }

    const bodyJSON = {
        login: login,
        password: password
    };

    try {
        const response = await fetch(`${Config.scheme}://${Config.host}/api/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bodyJSON)
        });

        if (response.status === 200) {
            const pay = await response.json();
            return pay;
        } else {
            return {err: response.status};
        }
    } catch (err) {
        return {err};
    }
}

export async function ping(session) {
    if (!session) {
        return {};
    }

    try {
        const response = await fetch(`${Config.scheme}://${Config.host}/api/ping`, {
            method: 'POST',
            headers: {
                'Authorization': session
            }
        });
    
        if (response.status === 200) {
            return {session: session};
        } else if (response.status === 401) {
            return {};
        } else {
            return {err: response.status};
        }
    } catch (err) {
        return {
            err
        };
    }
}

const socketManager = {
    socket: null,

    getSocket: async function () {
        if (this.socket) {
            if (this.socket.readyState === 1) {
                return this.socket;
            }

            return this.socket;
        }

        this.socket = new Promise(function (resolve, reject) {
            let socket = new WebSocket(`${Config.wsSheme}://${Config.host}/api/ws`);

            socket.onopen = function (e) {
                if (DEBUG) {
                    console.log("[WS] Connection opened");
                }

                this.socket = socket;
                resolve(this.socket);
                return;
            };

            socket.onmessage = async function (event) {
                if (DEBUG) {
                    console.log(`[WS] Message: ${event.data}`);
                }

                const text = await event.data.text();
                const msg = JSON.parse(text);
                if (DEBUG) {
                    console.info(`[WS] Message parsed: ${msg}`);
                }

                if (msg.type === 'update') {
                    updateMindFileHandler(msg);
                }

                if (msg.type === 'event') {
                    updateMindFileEventHandler(msg);
                }

                if (msg.type === 'event-done') {
                    doneMindFileEventHandler(msg);
                }

                if (msg.type === 'users') {
                    updateMindFileUsersHandler(msg);
                }
            };

            socket.onclose = function (event) {
                if (event.wasClean) {
                    if (DEBUG) {
                        console.log(`[WS] Connection closed cleaned, ${event.code}, ${event.reason}`);
                    }
                } else {
                    if (DEBUG) {
                        console.log('[WS] Connection aborted');
                    }
                }

                socket = null;
            };

            socket.onerror = function (err) {
                if (DEBUG) {
                    console.log(`[WS] Error ${err}`);
                }
                
                reject();
            };
        });

        return this.socket;
    }
};