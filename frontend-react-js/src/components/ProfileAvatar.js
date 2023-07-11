import './ProfileAvatar.css';

export default function ProfileAvatar(props) {
  const backgroundImage = `url("https://assets.cruddur-app.click/avatars/${props.id}.jpg")`;
  const styles = {
    backgroundImage: backgroundImage,
    backgroundSize: 'cover',
    backgroundPosition: 'center',Ò
  };

  return (
    <div 
      className="profile-avatar"
      style={styles}
    ></div>
  );
}