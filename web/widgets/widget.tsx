import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { useApp } from '@modelcontextprotocol/ext-apps/react';
import type { WidgetState, ToolResultData } from '../lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import '../styles/globals.css';

// Prefixed logging pattern for better debugging
const log = {
  info: console.log.bind(console, '[Widget]'),
  warn: console.warn.bind(console, '[Widget]'),
  error: console.error.bind(console, '[Widget]'),
};

function Widget() {
  const [state, setState] = useState<WidgetState>({ status: 'idle' });
  const [data, setData] = useState<ToolResultData | null>(null);

  const { app } = useApp({
    appInfo: {
      name: "{{SERVER_ID}}-mcp",
      version: "1.0.0",
    },
    capabilities: {},
    onAppCreated: (appInstance) => {
      // Handle tool input parameters
      appInstance.ontoolinput = (params) => {
        log.info('Tool input received:', params.arguments);
        setState({ status: 'loading' });
      };

      // Handle tool result
      appInstance.ontoolresult = (result) => {
        log.info('Tool result received:', result);
        try {
          // Extract data from structuredContent or content
          const resultData = result.structuredContent ||
            (result.content?.[0]?.text ? JSON.parse(result.content[0].text) : null);

          if (resultData) {
            setData(resultData);
            setState({ status: 'success', data: resultData });
          }
        } catch (e) {
          log.error('Failed to parse result:', e);
          setState({ status: 'error', error: 'Failed to parse result' });
        }
      };

      // Handle errors
      appInstance.onerror = (error) => {
        log.error('Error:', error);
        setState({ status: 'error', error: String(error) });
      };

      // Handle theme and viewport changes
      appInstance.onhostcontextchanged = (context) => {
        if (context.theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        if (context.viewport) {
          log.info('Viewport:', context.viewport);
        }
      };

      // Handle teardown
      appInstance.onteardown = async (params) => {
        log.info('Teardown requested:', params);
        // TODO: Save any state if needed
        return {};
      };
    },
  });

  // TODO: Implement your widget UI here
  // This is a template - replace with actual functionality

  if (state.status === 'idle') {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center bg-white dark:bg-slate-900">
        <Card className="w-full max-w-md mx-4">
          <CardHeader>
            <CardTitle>{{SERVER_NAME}}</CardTitle>
            <CardDescription>
              TODO: Add widget description and initial state
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500 dark:text-gray-400">
              Waiting for tool input...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.status === 'loading') {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center bg-white dark:bg-slate-900">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-3">Loading...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center bg-white dark:bg-slate-900">
        <Card className="w-full max-w-md mx-4 border-red-200">
          <CardHeader>
            <CardTitle className="text-red-500">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-500">{state.error}</p>
            <Button
              className="mt-4"
              onClick={() => setState({ status: 'idle' })}
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state - display result
  return (
    <div className="h-[600px] flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
      <Card className="flex-1 m-4 flex flex-col">
        <CardHeader>
          <CardTitle>{{SERVER_NAME}}</CardTitle>
          <CardDescription>
            {data?.message || 'Result received'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto">
          {/* TODO: Render your result data here */}
          <pre className="text-sm bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

// Mount the app
const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <Widget />
    </StrictMode>
  );
}
