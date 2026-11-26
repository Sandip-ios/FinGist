import { createContext, useContext } from 'react';

/** Lets any card open the Search screen for a company or topic (e.g. when a company tag is tapped). */
export const OpenSearchContext = createContext<(query: string) => void>(() => {});
export const useOpenSearch = () => useContext(OpenSearchContext);
