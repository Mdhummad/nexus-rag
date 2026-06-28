import { useState, useEffect, useCallback } from "react";
import { api } from "../utils/api.js";

export function usePapers() {
    const [papers, setPapers] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        api.getPapers().then(setPapers).catch(console.error);
    }, []);

    const upload = useCallback(async (file) => {
        setUploading(true);
        setUploadingFile(file.name);
        setError(null);
        try {
            const paper = await api.uploadPaper(file);
            setPapers((prev) => [paper, ...prev]);
            return paper;
        } catch (e) {
            setError(e.message);
            throw e;
        } finally {
            setUploading(false);
            setUploadingFile(null);
        }
    }, []);

    const remove = useCallback(async (id) => {
        await api.deletePaper(id);
        setPapers((prev) => prev.filter((p) => p.id !== id));
    }, []);

    return { papers, uploading, uploadingFile, error, upload, remove };
}