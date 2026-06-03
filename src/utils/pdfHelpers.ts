
export const urlToBase64 = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Image load timeout')), 8000);

        fetch(url, { cache: 'no-store' })
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.blob();
            })
            .then(blob => new Promise<string>((res, rej) => {
                const reader = new FileReader();
                reader.onloadend = () => { clearTimeout(timeout); res(reader.result as string); };
                reader.onerror = () => { clearTimeout(timeout); rej(new Error('FileReader failed')); };
                reader.readAsDataURL(blob);
            }))
            .then(resolve)
            .catch(err => { clearTimeout(timeout); reject(err); });
    });
};
