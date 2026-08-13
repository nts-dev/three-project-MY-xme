import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FaBox } from 'react-icons/fa';
import { generateModelThumbnail } from './modelAssets.js';
import { getThumbnailFileName, persistGeneratedThumbnail, thumbnailCandidates } from './thumbnailStore.js';

const thumbnailStateCache = new Map();

const getThumbnailCacheKey = (file) => (
    getThumbnailFileName(file)
);

const getCachedThumbnailState = (file) => (
    thumbnailStateCache.get(getThumbnailCacheKey(file)) || {}
);

const cacheThumbnailState = (file, patch) => {
    const key = getThumbnailCacheKey(file);
    thumbnailStateCache.set(key, {
        ...(thumbnailStateCache.get(key) || {}),
        ...patch,
    });
};

const useNearViewport = () => {
    const ref = useRef(null);
    const [isNearViewport, setIsNearViewport] = useState(() => (
        typeof IntersectionObserver === 'undefined'
    ));

    useEffect(() => {
        const node = ref.current;
        if (!node || typeof IntersectionObserver === 'undefined') {
            setIsNearViewport(true);
            return undefined;
        }

        const observer = new IntersectionObserver(([entry]) => {
            if (!entry?.isIntersecting) return;

            setIsNearViewport(true);
            observer.disconnect();
        }, {
            root: null,
            rootMargin: '320px',
            threshold: 0.01,
        });

        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    return [ref, isNearViewport];
};

const AssetThumbnail = ({ file }) => {
    const [visibilityRef, isNearViewport] = useNearViewport();
    const [src, setSrc] = useState(() => getCachedThumbnailState(file).src || null);
    const [loading, setLoading] = useState(() => getCachedThumbnailState(file).loading ?? true);
    const [pngCandidateIndex, setPngCandidateIndex] = useState(() => (
        getCachedThumbnailState(file).pngCandidateIndex || 0
    ));
    const [useGenerated, setUseGenerated] = useState(() => (
        getCachedThumbnailState(file).useGenerated || false
    ));

    const candidates = useMemo(() => thumbnailCandidates(file), [file]);

    useEffect(() => {
        const cached = getCachedThumbnailState(file);

        setSrc(cached.src || null);
        setLoading(cached.loading ?? true);
        setPngCandidateIndex(cached.pngCandidateIndex || 0);
        setUseGenerated(cached.useGenerated || false);
    }, [file]);

    useEffect(() => {
        if (!useGenerated || !isNearViewport) return undefined;

        let cancelled = false;

        generateModelThumbnail(file.path, file.extension, file.textures)
            .then((image) => {
                if (!cancelled) {
                    setSrc(image);
                    setLoading(false);
                    cacheThumbnailState(file, {
                        src: image,
                        loading: false,
                        useGenerated: true,
                    });
                    persistGeneratedThumbnail(file, image);
                }
            })
            .catch((error) => {
                console.warn('Thumbnail generation failed:', file.path, error);

                if (!cancelled) {
                    setSrc(null);
                    setLoading(false);
                    cacheThumbnailState(file, {
                        src: null,
                        loading: false,
                        useGenerated: true,
                    });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [useGenerated, isNearViewport, file.path, file.extension, file.textures]);

    if (!isNearViewport) {
        return (
            <span ref={visibilityRef} className="asset-thumb-fallback">
                ...
            </span>
        );
    }

    if (src) {
        return <img ref={visibilityRef} src={src} alt="" loading="lazy" decoding="async" />;
    }

    if (!useGenerated && candidates.length) {
        return (
            <img
                ref={visibilityRef}
                src={candidates[pngCandidateIndex]}
                alt=""
                loading="lazy"
                decoding="async"
                onLoad={() => {
                    const candidate = candidates[pngCandidateIndex];
                    setSrc(candidate);
                    setLoading(false);
                    cacheThumbnailState(file, {
                        src: candidate,
                        loading: false,
                        pngCandidateIndex,
                        useGenerated: false,
                    });
                }}
                onError={() => {
                    if (pngCandidateIndex < candidates.length - 1) {
                        setPngCandidateIndex((index) => {
                            const nextIndex = index + 1;
                            cacheThumbnailState(file, { pngCandidateIndex: nextIndex });
                            return nextIndex;
                        });
                    } else {
                        cacheThumbnailState(file, {
                            pngCandidateIndex,
                            useGenerated: true,
                        });
                        setUseGenerated(true);
                    }
                }}
            />
        );
    }

    return (
        <span ref={visibilityRef} className="asset-thumb-fallback">
            {loading ? '...' : <FaBox />}
        </span>
    );
};

export default AssetThumbnail;
