/**
 * Avatar — img with automatic fallback to DiceBear if src fails or is empty.
 * Usage: <Avatar src={user.avatar} name={user.name} size={40} />
 */
export default function Avatar({ src, name = '?', size = 40, style = {}, onClick }) {
  const fallback = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=b45309,92400e,d97706,ca8a04&fontFamily=Arial&fontSize=40`;

  const handleError = e => {
    if (e.target.src !== fallback) e.target.src = fallback;
  };

  return (
    <img
      src={src || fallback}
      alt={name}
      onError={handleError}
      onClick={onClick}
      style={{
        width: size, height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        display: 'block',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
