-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Sep 25, 2025 at 01:05 PM
-- Server version: 8.4.0
-- PHP Version: 8.3.8

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `mining_safety`
--

-- --------------------------------------------------------

--
-- Table structure for table `devicedb`
--

CREATE TABLE `devicedb` (
  `device_id` int NOT NULL,
  `device_name` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `devicedb`
--

INSERT INTO `devicedb` (`device_id`, `device_name`) VALUES
(12, 'device2'),
(13, 'device1'),
(14, 'device3');

-- --------------------------------------------------------

--
-- Table structure for table `device_assignment`
--

CREATE TABLE `device_assignment` (
  `emp_id` int NOT NULL,
  `device_id` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `device_assignment`
--

INSERT INTO `device_assignment` (`emp_id`, `device_id`) VALUES
(1, 12),
(2, 13),
(3, 14);

-- --------------------------------------------------------

--
-- Table structure for table `employees`
--

CREATE TABLE `employees` (
  `emp_id` int NOT NULL,
  `first_name` text NOT NULL,
  `surname` text NOT NULL,
  `position` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `employees`
--

INSERT INTO `employees` (`emp_id`, `first_name`, `surname`, `position`) VALUES
(1, 'Kondwani', 'Phiri', 'miner'),
(2, 'Kunda', 'Munshifwa', 'miner'),
(3, 'Jonathan', 'Mwamba', 'miner'),
(4, 'Jane', 'Kashala', 'supervisor'),
(5, 'Gift', 'Zulu', 'supervisor'),
(6, 'Mubelesi', 'Hanyumbu', 'miner');

-- --------------------------------------------------------

--
-- Table structure for table `login`
--

CREATE TABLE `login` (
  `id` int NOT NULL,
  `username` text NOT NULL,
  `position` text NOT NULL,
  `password` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `login`
--

INSERT INTO `login` (`id`, `username`, `position`, `password`) VALUES
(1, 'admin', 'admin', 123456),
(4, 'Jane', 'supervisor', 1234567);

-- --------------------------------------------------------

--
-- Table structure for table `thresholds`
--

CREATE TABLE `thresholds` (
  `parameter` varchar(50) NOT NULL,
  `unit` varchar(10) DEFAULT NULL,
  `caution_threshold` decimal(10,2) DEFAULT NULL,
  `caution_exposure` varchar(20) DEFAULT NULL,
  `warning_threshold` decimal(10,2) DEFAULT NULL,
  `warning_exposure` varchar(20) DEFAULT NULL,
  `critical_threshold` decimal(10,2) DEFAULT NULL,
  `critical_exposure` varchar(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `thresholds`
--

INSERT INTO `thresholds` (`parameter`, `unit`, `caution_threshold`, `caution_exposure`, `warning_threshold`, `warning_exposure`, `critical_threshold`, `critical_exposure`) VALUES
('ammonia', 'ppm', 15.00, '8 hours', 30.00, '15 minutes', 35.00, 'Immediate evacuation'),
('bodyTemp', '°C', 37.50, '1 hour', 38.50, '30 minutes', 39.00, 'Immediate evacuation'),
('carbonMonoxide', 'ppm', 60.00, '8 hours', 70.00, '1 hour', 80.00, 'Immediate evacuation'),
('heartRate', 'bpm', 100.00, '1 hour', 130.00, '15 minutes', 140.00, 'Immediate evacuation'),
('humidity', '%', 60.00, '8 hours', 85.00, '2 hours', 90.00, 'Immediate evacuation'),
('hydrogenSulfide', 'ppm', 90.00, '8 hours', 100.00, '10 minutes', 120.00, 'Immediate evacuation'),
('methane', 'ppm', 1970.00, '8 hours', 1980.00, '1 hour', 1990.00, 'Immediate evacuation'),
('nitrogenDioxide', 'ppm', 3.00, '8 hours', 8.00, '15 minutes', 10.00, 'Immediate evacuation'),
('pressure', 'hPa', 960.00, '8 hours', 940.00, '2 hours', 930.00, 'Immediate evacuation'),
('sulphurDioxide', 'ppm', 2.00, '8 hours', 8.00, '15 minutes', 10.00, 'Immediate evacuation'),
('temperature', '°C', 30.00, '4 hours', 38.00, '1 hour', 40.00, 'Immediate evacuation');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `devicedb`
--
ALTER TABLE `devicedb`
  ADD PRIMARY KEY (`device_id`);

--
-- Indexes for table `employees`
--
ALTER TABLE `employees`
  ADD PRIMARY KEY (`emp_id`);

--
-- Indexes for table `login`
--
ALTER TABLE `login`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `thresholds`
--
ALTER TABLE `thresholds`
  ADD PRIMARY KEY (`parameter`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `devicedb`
--
ALTER TABLE `devicedb`
  MODIFY `device_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT for table `employees`
--
ALTER TABLE `employees`
  MODIFY `emp_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `login`
--
ALTER TABLE `login`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
