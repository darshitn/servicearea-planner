export async function authenticatedFetch(url, options) {
  const response = await fetch(url, options)
  if (response.status === 401) window.dispatchEvent(new Event('planner-session-expired'))
  return response
}
