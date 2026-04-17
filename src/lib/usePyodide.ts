"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface PyodideInterface {
  runPythonAsync: (code: string) => Promise<any>;
  runPython: (code: string) => any;
  globals: any;
}

type PyodideStatus = "idle" | "loading" | "ready" | "error";

/**
 * Strip Pyodide internal frames from traceback, keep only user code frames + final error.
 *
 * Raw Pyodide traceback looks like:
 *   Traceback (most recent call last):
 *     File "/lib/python312.zip/_pyodide/_base.py", line 597, in eval_code_async
 *       await CodeRunner(...)
 *     File "<exec>", line 3, in <module>
 *   NameError: name 'x' is not defined
 *
 * We want:
 *   Traceback (most recent call last):
 *     File "<exec>", line 3, in <module>
 *   NameError: name 'x' is not defined
 */
function cleanTraceback(raw: string): string {
  const lines = raw.split("\n");
  const result: string[] = [];
  let i = 0;

  // Keep "Traceback ..." header
  if (lines[0]?.startsWith("Traceback")) {
    result.push(lines[0]);
    i = 1;
  }

  // Walk through frame lines — only keep frames from "<exec>" (user code)
  while (i < lines.length) {
    const line = lines[i];

    if (line.match(/^\s+File\s+"/)) {
      // This is a frame header like:  File "<exec>", line 3, in <module>
      const isUserFrame = line.includes('"<exec>"');
      if (isUserFrame) {
        result.push(line);
        // Collect indented continuation lines (source snippet, caret ^^^, etc.)
        i++;
        while (i < lines.length && lines[i].match(/^\s+/) && !lines[i].match(/^\s+File\s+"/)) {
          result.push(lines[i]);
          i++;
        }
      } else {
        // Skip this internal frame and its continuation lines
        i++;
        while (i < lines.length && lines[i].match(/^\s+/) && !lines[i].match(/^\s+File\s+"/)) {
          i++;
        }
      }
    } else {
      // Final error line(s) like "SyntaxError: invalid syntax"
      result.push(line);
      i++;
    }
  }

  return result.join("\n").trim() || raw.trim();
}

let pyodideInstance: PyodideInterface | null = null;
let pyodideLoadingPromise: Promise<PyodideInterface> | null = null;

async function loadPyodideOnce(): Promise<PyodideInterface> {
  if (pyodideInstance) return pyodideInstance;
  if (pyodideLoadingPromise) return pyodideLoadingPromise;

  pyodideLoadingPromise = (async () => {
    // Load the Pyodide script from CDN
    if (!(window as any).loadPyodide) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Pyodide script"));
        document.head.appendChild(script);
      });
    }

    const pyodide = await (window as any).loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
    });

    pyodideInstance = pyodide;
    return pyodide;
  })();

  return pyodideLoadingPromise;
}

export function usePyodide() {
  const [status, setStatus] = useState<PyodideStatus>(pyodideInstance ? "ready" : "idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pyodideInstance) {
      setStatus("ready");
      return;
    }

    setStatus("loading");
    loadPyodideOnce()
      .then(() => setStatus("ready"))
      .catch((err) => {
        setStatus("error");
        setError(err.message);
      });
  }, []);

  const runPython = useCallback(async (code: string): Promise<{ output: string; error: string | null }> => {
    if (!pyodideInstance) {
      return { output: "", error: "Pyodide is not loaded yet" };
    }

    try {
      // Redirect stdout/stderr
      pyodideInstance.runPython(`
import sys
from io import StringIO
_stdout_capture = StringIO()
_stderr_capture = StringIO()
sys.stdout = _stdout_capture
sys.stderr = _stderr_capture
`);

      // Run user code
      await pyodideInstance.runPythonAsync(code);

      // Get captured output
      const stdout = pyodideInstance.runPython("_stdout_capture.getvalue()");
      const stderr = pyodideInstance.runPython("_stderr_capture.getvalue()");

      // Restore
      pyodideInstance.runPython(`
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
`);

      if (stderr) {
        return { output: stdout, error: stderr };
      }

      return { output: stdout, error: null };
    } catch (err: any) {
      // Pyodide writes the full traceback to stderr, while err.message
      // is often empty for PythonError. Read captured stderr BEFORE restoring.
      let capturedStderr = "";
      let capturedStdout = "";
      try {
        capturedStderr = pyodideInstance.runPython("_stderr_capture.getvalue()") || "";
        capturedStdout = pyodideInstance.runPython("_stdout_capture.getvalue()") || "";
      } catch {}

      // Restore stdout/stderr
      try {
        pyodideInstance.runPython(`
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
`);
      } catch {}

      // Prefer stderr (has full traceback with line numbers), fallback to err.message
      const raw = capturedStderr || (err as Error).message || String(err);
      const stripped = raw.startsWith("PythonError: ") ? raw.slice(13) : raw;

      return { output: capturedStdout, error: cleanTraceback(stripped) };
    }
  }, []);

  return { status, error, runPython };
}
