export interface UploadedFiles {
  image?: Express.Multer.File[]
  coverPhoto?: Express.Multer.File[]
  profile?: Express.Multer.File[]
  images?: Express.Multer.File[]
  beforeStory?: Express.Multer.File[]
  afterStory?: Express.Multer.File[]
  videos?: Express.Multer.File[]
  documents?: Express.Multer.File[]
}
