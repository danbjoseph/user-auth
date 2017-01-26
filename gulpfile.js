var gulp = require('gulp');
var autoprefixer = require('gulp-autoprefixer');
var sass = require('gulp-sass');

var sassInput = './stylesheets/*.scss';
var sassOptions = {
  includePaths: ['./node_modules/foundation-sites/scss','./node_modules/font-awesome/scss' ],
  errLogToConsole: true,
  outputStyle: 'expanded'
};
var autoprefixerOptions = {
  browsers: ['last 2 versions', 'ie >= 9', 'and_chr >= 2.3']
};

gulp.task('sass', function() {
  return gulp
    .src(sassInput)
    .pipe(sass(sassOptions).on('error', sass.logError))
    .pipe(autoprefixer(autoprefixerOptions))
    .pipe(gulp.dest('./public/css'));
});

gulp.task('icons', function() {
  return gulp.src('./node_modules/font-awesome/fonts/**.*')
    .pipe(gulp.dest('./public/fonts'));
});

gulp.task('watch', function() {
  gulp.watch(sassInput, ['sass']);
});

gulp.task('dev', ['sass', 'icons', 'watch']);
gulp.task('default', ['sass', 'icons']);
