export function vapiBrowserConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY && process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID);
}

export function vapiToolsConfigured(): boolean {
  return !!process.env.VAPI_SERVER_SECRET;
}
