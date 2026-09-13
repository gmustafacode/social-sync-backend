import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function updateDoc() {
  await mongoose.connect(process.env.MONGO_URI);
  const res = await mongoose.connection.collection('socialaccounts').updateOne(
    { platform: 'linkedin' },
    {
      $set: {
        email: 'developerssphere@gmail.com',
        picture: 'https://media.licdn.com/dms/image/v2/D4E03AQESA7Bj7AD-tA/profile-displayphoto-shrink_100_100/profile-displayphoto-shrink_100_100/0/1730779366851?e=1790812800&v=beta&t=kJLKVg3r64YEhOKIzzHJqu9pxrNuXjiLeTp1rrA58ug',
        profileImage: 'https://media.licdn.com/dms/image/v2/D4E03AQESA7Bj7AD-tA/profile-displayphoto-shrink_100_100/profile-displayphoto-shrink_100_100/0/1730779366851?e=1790812800&v=beta&t=kJLKVg3r64YEhOKIzzHJqu9pxrNuXjiLeTp1rrA58ug',
        username: 'Ghulam Mustafa'
      }
    }
  );
  console.log('Update result:', res.modifiedCount, 'documents modified');
  await mongoose.disconnect();
}
updateDoc();
