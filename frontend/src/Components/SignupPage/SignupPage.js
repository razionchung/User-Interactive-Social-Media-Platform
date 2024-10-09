import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import config from '../../config.json';
import './SignupPage.css';

const SignupForm = () => {
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    username: '',
    password: '',
    confirm_password: '',
    affiliation: '',
    birthday: '',  
    photo: null
  });

  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "photo") {
      resizeImage(files[0], 800, 800, (blob) => {
        setFormData(prevData => ({
          ...prevData,
          photo: blob
        }));
      });
    } else {
      setFormData(prevData => ({
        ...prevData,
        [name]: value
      }));
    }
  };

  const resizeImage = (file, maxWidth, maxHeight, callback) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        let width = image.width;
        let height = image.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(image, 0, 0, width, height);
        canvas.toBlob(callback, 'image/jpeg', 0.95); // Create a Blob from the canvas
      };
      image.src = readerEvent.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleNext = async (e) => {
    e.preventDefault();
    console.log('Submitting form...');
    console.log(formData);

    if (formData.password !== formData.confirm_password) {
      alert("Passwords do not match.");
      return;
    }

    const rootURL = config.serverRootURL;
    const data = new FormData();
    data.append('email', formData.email);
    data.append('first_name', formData.first_name);
    data.append('last_name', formData.last_name);
    data.append('username', formData.username);
    data.append('password', formData.password);
    data.append('birthday', formData.birthday); 
    data.append('affiliation', formData.affiliation); 
    data.append('photo', formData.photo);
  
    for (let [key, value] of data.entries()) {
      console.log(key, value);
    }
    try {
      const response = await axios.post(`${rootURL}/register`, data, 
      { headers: { 'Content-Type': 'multipart/form-data' } });

      if (response.status === 200) {
          console.log('Registration successful!');
          // Submit the formData including the resized photo Blob to the server here
          // After submission, navigate to the second signup page
          navigate(`/secondsignup?username=${response.data.username}&profile_pic=${response.data.profile_pic}`);
      } else {
        throw new Error('Failed to register');
      }
    } catch (error) {
      alert("Registration failed. " + (error.response?.data?.error || error.message));
      console.error('Failed to submit the form:', error);
  }
  };

  return (
    <div className="signup-form-container">
        <div className="signup-form-card">
            <div className="form-header">
                <img src="loginpage_header.png" alt="Sign Up" />
            </div>
            <form onSubmit={handleNext} className="form-body">
                <div className="input-group">
                    <label htmlFor="email" className="input-label">Mobile Number or Email</label>
                    <input
                        id="email"
                        type="text"
                        name="email"
                        placeholder="Enter your email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div className="input-group">
                    <label htmlFor="firstName" className="input-label">First Name</label>
                    <input
                        id="firstName"
                        type="text"
                        name="first_name"
                        placeholder="Enter your first name"
                        value={formData.first_name}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div className="input-group">
                    <label htmlFor="lastName" className="input-label">Last Name</label>
                    <input
                        id="lastName"
                        type="text"
                        name="last_name"
                        placeholder="Enter your last name"
                        value={formData.last_name}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div className="input-group">
                    <label htmlFor="birthday" className="input-label">Birthday</label>
                    <input
                        id="birthday"
                        type="date"
                        name="birthday"
                        value={formData.birthday}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div className="input-group">
                    <label htmlFor="username" className="input-label">Username</label>
                    <input
                        id="username"
                        type="text"
                        name="username"
                        placeholder="Choose a username"
                        value={formData.username}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div className="input-group">
                    <label htmlFor="password" className="input-label">Password</label>
                    <input
                        id="password"
                        type="password"
                        name="password"
                        placeholder="Enter your password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div className="input-group">
                    <label htmlFor="confirmPassword" className="input-label">Confirm Password</label>
                    <input
                        id="confirmPassword"
                        type="password"
                        name="confirm_password"
                        placeholder="Confirm your password"
                        value={formData.confirm_password}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div className="input-group">
                    <label htmlFor="affiliation" className="input-label">Affiliation</label>
                    <input
                        id="affiliation"
                        type="text"
                        name="affiliation"
                        placeholder="Enter your affiliation"
                        value={formData.affiliation}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div className="input-group">
                    <label htmlFor="photo" className="input-label">Profile Photo</label>
                    <input
                        id="photo"
                        type="file"
                        name="photo"
                        onChange={handleChange}
                        required
                    />
                </div>
                <div className="form-footer">
                    <button type="submit" className="submit-btn">Sign Up</button>
                </div>
            </form>
            <div className="alternate-action">
                Already have an account? <button onClick={() => navigate('/')} className="link-button">Log in</button>
            </div>
        </div>
    </div>
);

};

export default SignupForm;
