import { useState, useEffect, useCallback } from "react";
import { api } from "../utils/api.js";

export function usePapers() {
    const [papers,  setPapers]  = useState([]);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState(null);

    const reload = useCallback(() => {
        setLoading(true);
        api.getPapers()
            .then(setPapers)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { reload(); }, [reload]);

    return { papers, loading, error, reload };
}