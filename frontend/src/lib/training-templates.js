// Candidate pools, not fixed prescriptions. personalized-plan applies experience,
// goal, weekly volume and the available duration before saving each routine.
// Compound patterns precede accessories; mixed days retain complementary patterns.
// Every id belongs to the checked local animation catalogue.
export const TRAINING_TEMPLATES = {
  full: ['Full Body', 'dumbbell', ['0043', '0025', '0198', '0085', '0405', '0861', '0605', '0276']],
  full_a: ['Full Body A', 'dumbbell', ['0043', '0025', '0198', '0085', '0334', '0201', '0605', '0276']],
  full_b: ['Full Body B', 'dumbbell', ['0739', '0314', '0861', '0381', '0586', '0378', '0294', '0872']],
  upper: ['Upper Body', 'chest', ['0025', '0198', '0405', '0861', '0334', '0294', '0201', '0378']],
  lower: ['Lower Body', 'legs', ['0043', '0085', '0381', '0586', '0585', '0605', '0597', '0276']],
  push: ['Chest, Shoulders & Triceps', 'chest', ['0025', '0405', '0047', '0334', '0201', '0227', '1722']],
  pull: ['Back, Rear Shoulders & Biceps', 'back', ['0198', '0027', '0378', '0294', '0861', '0313', '0238']],
  chest_triceps: ['Chest & Triceps', 'chest', ['0025', '0047', '0201', '0227', '1722', '0662', '0060']],
  back_biceps: ['Back & Biceps', 'back', ['0198', '0027', '0294', '0861', '0313', '0378', '0238']],
  legs_core: ['Legs & Core', 'legs', ['0043', '0085', '0276', '0381', '0586', '0605', '0585', '0872']],
  shoulders_abs: ['Shoulders & Abs', 'shoulders', ['0405', '0334', '0274', '0378', '0979', '0178', '0472']],
  arms_core: ['Arms & Core', 'arm', ['0294', '0201', '0276', '0313', '1722', '0979', '0080']],
  glutes_legs: ['Glutes & Legs', 'glutes', ['1409', '0043', '0085', '0381', '0586', '0597', '0605', '0585']],
  conditioning: ['Conditioning', 'bolt', ['2138', '1760', '0493', '0861', '0431', '0276', '3224']],
  cardio_core: ['Cardio & Core', 'heart', ['2138', '0276', '0979', '0872', '2311', '0006']],
  recovery: ['Active Recovery', 'heart', ['1604', '1511', '0669', '1377', '1494', '0276']],
  chest: ['Chest Day', 'chest', ['0025', '0047', '0227', '0577', '0662', '0171']],
  back: ['Back Day', 'back', ['0198', '0027', '0861', '0238', '0378', '0489']],
  legs: ['Leg Day', 'legs', ['0043', '0085', '0381', '0586', '0585', '0605', '0597']],
  abs: ['Abs Day', 'abs', ['0276', '0274', '0979', '0872', '0006']],
  arms: ['Arms Day', 'arm', ['0294', '0201', '0313', '1722', '0447', '0351']],
  shoulders: ['Shoulders Day', 'shoulders', ['0405', '0334', '0378', '0178', '0225']],
  glutes: ['Glutes Day', 'glutes', ['1409', '0085', '0381', '0597', '0228', '0586']],
  biceps: ['Biceps Day', 'arm', ['0294', '0313', '0318', '0868']],
  triceps: ['Triceps Day', 'arm', ['0201', '1722', '0030', '0351']],
  forearms: ['Forearms Day', 'arm', ['0080', '0126', '0385']],
  calves: ['Calves Day', 'legs', ['0605', '0594', '1387']],
  hamstrings: ['Hamstrings Day', 'legs', ['0085', '0586', '1757', '1409']],
  quads: ['Quadriceps Day', 'legs', ['0043', '0739', '0381', '0585']],
}

// Machine cardio uses minutes. Bodyweight circuits use seconds per work bout.
// 0003 is the abdominal bicycle movement, not a stationary bicycle machine.
export const TRAINING_CARDIO_IDS = new Set(['2138', '2311', '2142'])
export const TRAINING_TIMED_IDS = new Set([
  '1160', '2612', '0630', '3224', '0514', '3360', '3552',
  '1604', '1511', '0669', '1377', '1494',
])
