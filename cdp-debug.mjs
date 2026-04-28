const createTarget = async (url) => {
  const response = await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(url)}`, {
    method: "PUT"
  });
  if (!response.ok) {
    throw new Error(`Failed to create CDP target: ${response.status}`);
  }

  return response.json();
};

const main = async () => {
  console.log("starting");
  const target = await createTarget("about:blank");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;

  const send = (method, params = {}) => {
    ws.send(JSON.stringify({id: ++id, method, params}));
  };

  ws.onopen = () => {
    console.log("open");
    send("Page.enable");
    send("Runtime.enable");
    send("Log.enable");
    send("Page.navigate", {
      url: "http://localhost:3010/?previewLane=hyperframes"
    });
    setTimeout(() => {
      send("Runtime.evaluate", {
        expression: 'document.body ? document.body.innerText : ""',
        returnByValue: true
      });
    }, 20000);
    setTimeout(() => {
      send("Runtime.evaluate", {
        expression: "document.documentElement.outerHTML",
        returnByValue: true
      });
    }, 20500);
    setTimeout(() => {
      console.log("closing");
      ws.close();
    }, 23000);
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.method === "Runtime.exceptionThrown") {
      console.log("EXCEPTION", JSON.stringify(data.params));
      return;
    }

    if (data.method === "Runtime.consoleAPICalled") {
      console.log("CONSOLE", JSON.stringify(data.params));
      return;
    }

    if (data.method === "Log.entryAdded") {
      console.log("LOG", JSON.stringify(data.params));
      return;
    }

    if (data.id && data.result?.result && Object.prototype.hasOwnProperty.call(data.result.result, "value")) {
      console.log("EVAL", String(data.result.result.value).slice(0, 4000));
    }
  };

  ws.onerror = (event) => {
    console.error("WSERROR", event);
  };

  ws.onclose = () => {
    console.log("closed");
    process.exit(0);
  };

setTimeout(() => {
  console.log("failsafe exit");
  process.exit(0);
}, 26000);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
